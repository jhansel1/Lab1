//JS by Jonathan Hansel - October 2019
//create basemap and center on Chicago
function createMap(){
	var map = L.map('mapid',{
        measureControl: true,
		maxZoom: 17,
		minZoom:4,
	}).setView([41.8807,-87.6303],10.5);

    //add basemap
	var CartoDB = new L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
    map.addLayer(CartoDB);
    
    //add ruler tool 
    var options = {
        position: 'topright',
        lineStyle: {
            color: 'black',
            dashArray: '1,6'
        },
        lengthUnit: {
        factor: 0.621371, //from km to m
        display: 'Miles',
        decimal: 2,
        label: 'Distance'
          },
        };
    L.control.ruler(options).addTo(map);
    
getData(map);
};

//import GeoJSON data
function getData(map) {
	// load the red line station data
	$.ajax("data/cta_red_line.geojson",{
		dataType:"json",
		success: function(response){
			//get attributes 
			var attributes = processData(response);
			//JS functions below
			createPropSymbols(response, map, attributes);
			createSequenceControls(map, attributes);
			createLegend(map, attributes);
		}
	});
};

//process attributes from data
function processData(data){
	var attributes = [];
	console.log(data);
	//properties of the first feature in the dataset
	var properties = data.features[0].properties;
	console.log(properties)
	//put attributes into array
	for (var attribute in properties){
		//search months through year
		if(attribute.indexOf("January"|"December") > -1){
			attributes.push(attribute);
		};
	};
	console.log(attributes);
	return attributes;
};

//create the symbols from the data
function pointToLayer (feature, latlng, attributes) {
	//create proportional symbols
	var attribute = attributes[0];
	//symbol options
	var options = {
		fillColor: '#C70039',
		color: '#fff',
		weight: 2,
		opacty: 0.5,
		fillOpacity: 0.5
	};
	//get value for attribute 
	var attValue = Number(feature.properties[attribute]);
	//build radius
	options.radius = calcPropRadius(attValue);
	//create circle marker layer
	var layer = L.circleMarker(latlng, options);
	
	createPopup(feature.properties, attribute, layer, options.radius);

	//event listeners to open popups when cursor is over
	layer.on({
		mouseover: function(){
			this.openPopup();
		},
		mouseout: function(){
			this.closePopup();
		},
	});
	
	return layer; 
};

//update prop circles with attributes
function updatePropSymbols(map, attribute) {
	map.eachLayer(function(layer) {
		if (layer.feature && layer.feature.properties[attribute]){
			//get properties 
			var props = layer.feature.properties;
			//update radius
			var radius = calcPropRadius(props[attribute]);
			layer.setRadius(radius);
			createPopup(props, attribute, layer, radius);

		};
	});
};

//calculate the radius for prop circles
function calcPropRadius(attValue) {
    //scale factor
    var scaleFactor = .01;
    //calculate area
    var area = (attValue * scaleFactor)/2;
    //calculate radius
    var radius = Math.sqrt(area/Math.PI);
    return radius;
};    

//create popups
function createPopup(properties, attribute, layer, radius) {
	//add station name
	var popupContent = "<p><b>Station: <b>" + properties["StationName"] + "</p>";
    //separate month from year
    //add month and customer numbers popup
	var month = attribute.split("_")[0];
	popupContent += "<p><b>" +"Month: " + month +"</p>" ;
	popupContent += "<p><b>" + "Customers: " + properties[attribute] + "</p>";
	//replace the layer popup 
	layer.bindPopup(popupContent, {
		offset: new L.Point(0,-radius)
	});
}

//create circle markers for points
function createPropSymbols(data, map, attributes) {
	//add GeoJSON layer to map
	var station = L.geoJson(data,{
		pointToLayer: function(feature, latlng){
			return pointToLayer(feature,latlng,attributes);
		}
	}).addTo(map);

	var cityRank = L.geoJson(data, {
		pointToLayer: function (feature, latlng){
			return cityMarkers(feature, latlng);
		}
	});
    //add layercontrol to map
    //L.control.layers(overlayOption).addTo(map);
};

//create city markers
function cityMarkers(feature, latlng) {
    //create popups
	var popupContent = "<p><b>Station: <b>" +feature.properties["StationName"]+ "</p>";
	var stationNum = Number(feature.properties["Number"]);
	popupContent += "<p><b>" +"Number : " + stationNum +"</p>" ;
	var layer = L.circleMarker(latlng);
	layer.bindPopup(popupContent,{offset: new L.point(10,10)
	});

	layer.on({
    mouseover: function(){
        this.openPopup();
    },
    mouseout: function(){
        this.closePopup();
    },
    click: function(){
        layer.on(popupContent);
    }
    });
    
    return layer;
};

//create sequence controls 
function createSequenceControls(map, attributes) {
    //create sequence variable
	var SequenceControl = L.Control.extend({
	options: {
        //place in bottom right in the water
		position: 'bottomright'
	},
	onAdd: function(map){
		var container = L.DomUtil.create('div', 'sequence-control-container');
		//add listener controls
		$(container).append('<input class="range-slider" type="range">');
        $(container).append('<button class="skip" id="reverse" title="Reverse"> << </button>');
        $(container).append('<button class="skip" id="forward" title="Forward"> >> </button>');
		//stop event listener
		$(container).on('mousedown dblclick pointerdown', function(e){
            L.DomEvent.stopPropagation(e);
        });

		return container;
		}
	});
	map.addControl(new SequenceControl());

    //slider for 12 months
	$('.range-slider').attr({
		max:11,
		min:0,
		value: 0,
		step:1
	});

	//create listener for buttons
	$('.skip').click(function() {
		//get the old index value
		var index = $('.range-slider').val();
		//proceed through months
		if ($(this).attr('id')=='forward'){
			index++;
			//return to Jan after Dec
			index = index > 11 ?0: index;
		} else if ($(this).attr('id')== 'reverse'){
			index--;
			//wrap back around to Jan
			index = index < 0 ? 11 : index;
		};
		//update functions as slider moves
		$('.range-slider').val(index);
		updatePropSymbols(map, attributes[index]);
		updateLegend(map, attributes[index]);
	});

		//update functions as slider moves
	$('.range-slider').on('input',function(){
		//sequence
		var index = $(this).val();
		updatePropSymbols(map, attributes[index]);
		updateLegend(map, attributes[index]);
	});
};

//create legend
function createLegend(map, attributes) {
    var LegendControl = L.Control.extend({
        options: {
            //place in bottom right in water
            position: 'bottomright'
        },
        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'legend-control-container');

            //add legend to container
            $(container).append('<div id="station-legend">')
            //start legend svg string
            var svg = '<svg id="attribute-legend" width="230px" height="120px">';
            //add labels
            var circles = {
                max: 50,
                mean: 75,
                min: 99             
            }
            
            //loop to update circles
            for (var circle in circles) {
                svg += 
                '<circle class="legend-circle" id="' + circle + 
                '" fill="#C70039" fill-opacity="0.6" stroke="#fff" stroke-width="1" cx="80" />';
                
                svg += '<text id="' + circle + '-text" x="150" y="' + circles[circle] + '"></text>';
            };
            
            svg += "</svg>";

            //add legend svg to container
            $(container).append(svg);

            return container;
        }
    });

    //run function
    map.addControl(new LegendControl());
    updateLegend(map, attributes[0]);
};

//update legend with new attributes
function updateLegend(map, attribute){
    //create title labels
    var month = attribute.split("_")[0];
    var content = "<b>Station Customers</b>" + "<br>" + month + " 2018";

    //replace legend content
    $('#station-legend').html("<id='legend-month'> "+content);
    
    var circleValues = getCircleValues(map, attribute);

    for (var key in circleValues) {
        var radius = calcPropRadius(circleValues[key]);

        //assign the centerpoint and radius
        $('#'+key).attr({
            cy: 100 - radius,
            r: radius
        });
        $('#'+key+'-text').text(Math.round(circleValues[key]*100)/100);
    };
};

//calculate max, mean and min values
function getCircleValues(map, attribute){
    //start with min at highest possible and max at lowest possible number
    var min = Infinity,
        max = -Infinity;

    map.eachLayer(function(layer){
        //get the attribute value
        if (layer.feature){
            var attributeValue = Number(layer.feature.properties[attribute]);

            //test for min
            if (attributeValue < min){
                min = attributeValue;
            };

            //test for max
            if (attributeValue > max){
                max = attributeValue;
            };
        };
    });

    //set mean
    var mean = (max + min) /2;

    //return max, mean and min
    return {
        max: max,
        mean: mean,
        min: min
    };
};

//$('#layerButton').click(function() {
//    if(map.hasLayer(layer)) {
//        map.removeLayer(layer);
//    } else {
//        map.addLayer(layer);
//    };
//});

$(document).ready(createMap);