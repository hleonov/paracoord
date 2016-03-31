
//var $j = jQuery.noConflict(); // Ensure included jQuery doesn't conflict with prototype
getOrderedDimensionKeys = function(){
    return d3.keys(__.dimensions).sort(function(x, y){
        return d3.ascending(__.dimensions[x].index, __.dimensions[y].index);
    });
};

var margin = {top: 30, right: 10, bottom: 10, left: 10},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;
var nullValueSeparator = "undefined"; // set to "top" or "bottom"
var nullValueSeparatorPadding = { top: 8, right: 0, bottom: 8, left: 0 };
var x = d3.scale.ordinal().rangePoints([0, width], 1),
    y = {},
    dragging = {},
    dimensions = {},
    types = {};

var line = d3.svg.line(),
    axis = d3.svg.axis().orient("left"),
    background,
    foreground;
var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

//d3.csv("data/cars.csv", function(error, cars) {
d3.tsv('tranche2.csv', function(cars) {
    console.log("cars: ", cars) //cars is an array of objects
    types = detectDimensionTypes(cars);
   //autoscale(cars);
    //

   /* // ORIG Extract the list of dimensions and create a scale for each.
    x.domain(dimensions = d3.keys(cars[0]).filter(function(d) {
        return d != "name" && (y[d] = d3.scale.linear()
                .domain(d3.extent(cars, function(p) { return +p[d]; }))
                .range([height, 0]));
    }));*/

    // Extract the list of dimensions and create a scale for each.
    x.domain(dimensions = d3.keys(cars[0]).slice(0,10).filter(function(d) {
        console.log("d is: ",d) //column name
        var extent = d3.extent(cars, function(k) {  return +k[d]; });
        console.log("extent", extent);
        if (d != "Compound Id") {
        return  y[d] = d3.scale.linear()
                .domain(d3.extent(cars, function(p) { return +p[d]; }))
                //.rangePoints(getRange())); //&& (y[d] = d3.scale.linear()
                .range([height, 0]);
        }

    }));
    console.log("domain: ",x.domain);


    // Add grey background lines for context.
    background = svg.append("g")
        .attr("class", "background")
        .selectAll("path")
        .data(cars)
        .enter().append("path")
        .attr("d", path);

    // Add blue foreground lines for focus.
    foreground = svg.append("g")
        .attr("class", "foreground")
        .selectAll("path")
        .data(cars)
        .enter().append("path")
        .attr("d", path);

    // Add a group element for each dimension.
    var g = svg.selectAll(".dimension")
        .data(dimensions)
        .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
        .call(d3.behavior.drag()
            .origin(function(d) { return {x: x(d)}; })
            .on("dragstart", function(d) {
                dragging[d] = x(d);
                background.attr("visibility", "hidden");
            })
            .on("drag", function(d) {
                dragging[d] = Math.min(width, Math.max(0, d3.event.x));
                foreground.attr("d", path);
                dimensions.sort(function(a, b) { return position(a) - position(b); });
                x.domain(dimensions);
                g.attr("transform", function(d) { return "translate(" + position(d) + ")"; })
            })
            .on("dragend", function(d) {
                delete dragging[d];
                transition(d3.select(this)).attr("transform", "translate(" + x(d) + ")");
                transition(foreground).attr("d", path);
                background
                    .attr("d", path)
                    .transition()
                    .delay(500)
                    .duration(0)
                    .attr("visibility", null);
            }));

    // Add an axis and title.
    g.append("g")
        .attr("class", "axis")
        .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
        .append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(function(d) { return d; });

    // Add and store a brush for each axis.
    g.append("g")
        .attr("class", "brush")
        .each(function(d) {
            d3.select(this).call(y[d].brush = d3.svg.brush().y(y[d]).on("brushstart", brushstart).on("brush", brush));
        })
        .selectAll("rect")
        .attr("x", -8)
        .attr("width", 16);
})

d3.select("#generate")
    .on("click", writeDownloadLink);

function writeDownloadLink(){
    try {
        var isFileSaverSupported = !!new Blob();
    } catch (e) {
        alert("blob not supported, cannot export .svg file");
    }

    var html = d3.select("svg")
        .attr("title", "parcoord")
        .attr("version", 1.1)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .node().parentNode.innerHTML;
    var blob = new Blob([html], {type: "image/svg+xml"});
    saveAs(blob, "parcoord.svg");
}

/*
 $j(document).ready(function () {
 $j('.export_svg').click(function () {

 });
 });
 */
function position(d) {
    var v = dragging[d];
    return v == null ? x(d) : v;
}

function transition(g) {
    return g.transition().duration(500);
}

// Returns the path for a given data point.
function path(d) {
   // console.log("path for: ", d)

    return line(dimensions.map(function(p) {
        //console.log(y[p](d));
        return [position(p), y[p](d[p])];
    }));
}

function brushstart() {
    d3.event.sourceEvent.stopPropagation();
}

// Handles a brush event, toggling the display of foreground lines.
function brush() {
    var actives = dimensions.filter(function(p) { return !y[p].brush.empty(); }),
        extents = actives.map(function(p) { return y[p].brush.extent(); });
    foreground.style("display", function(d) {
        return actives.every(function(p, i) {
            return extents[i][0] <= d[p] && d[p] <= extents[i][1];
        }) ? null : "none";
    });
}

// handle scales of different types (date, string, number)
function autoscale(data) {
    console.log("in autoscale")
    // yscale
    var defaultScales = {
        "date": function(k) {
            var extent = d3.extent(data, function(d) {
                return y[k] = d3.scale.linear() = d[k] ? d[k].getTime() : null;
            });

            // special case if single value
            if (extent[0] === extent[1]) {
                return d3.scale.ordinal()
                    .domain([extent[0]])
                    .rangePoints(getRange());
            }

            return d3.time.scale()
                .domain(extent)
                .range(getRange());
        },
        "number": function(k) {
            console.log("internal k: ", k)

            var extent = d3.extent(data, function(d) {
                console.log("internal d: ", d);
                return +d[k];
            });

            // special case if single value
            if (extent[0] === extent[1]) {
                return d3.scale.ordinal()
                    .domain([extent[0]])
                    .rangePoints(getRange());
            }

            return d3.scale.linear()
                .domain(extent)
                .range(getRange());
        },
        "string": function(k) {
            var counts = {},
                domain = [];

            // Let's get the count for each value so that we can sort the domain based
            // on the number of items for each value.
            data.map(function(p) {
                if (p[k] === undefined && __.nullValueSeparator!== "undefined"){
                    return; // null values will be drawn beyond the horizontal null value separator!
                }
                if (counts[p[k]] === undefined) {
                    counts[p[k]] = 1;
                } else {
                    counts[p[k]] = counts[p[k]] + 1;
                }
            });

            domain = Object.getOwnPropertyNames(counts).sort(function(a, b) {
                return counts[a] - counts[b];
            });

            return d3.scale.ordinal()
                .domain(domain)
                .rangePoints(getRange());
        }
    };

    /*d3.keys(__.dimensions).forEach(function(k) {
        if (!__.dimensions[k].yscale){
            __.dimensions[k].yscale = defaultScales[__.dimensions[k].type](k);
        }*/

//});

    // xscale
    //xscale.rangePoints([0, w()], 1);
/*
    // canvas sizes
    pc.selection.selectAll("canvas")
        .style("margin-top", __.margin.top + "px")
        .style("margin-left", __.margin.left + "px")
        .attr("width", w()+2)
        .attr("height", h()+2);

    // default styles, needs to be set when canvas width changes
    ctx.foreground.strokeStyle = __.color;
    ctx.foreground.lineWidth = 1.4;
    ctx.foreground.globalCompositeOperation = __.composite;
    ctx.foreground.globalAlpha = __.alpha;
    ctx.brushed.strokeStyle = __.brushedColor;
    ctx.brushed.lineWidth = 1.4;
    ctx.brushed.globalCompositeOperation = __.composite;
    ctx.brushed.globalAlpha = __.alpha;
    ctx.highlight.lineWidth = 3;*/

    return y;
};

/** adjusts an axis' default range [h()+1, 1] if a NullValueSeparator is set */
function getRange() {
    if (nullValueSeparator=="bottom") {
        return [h()+1-nullValueSeparatorPadding.bottom-nullValueSeparatorPadding.top, 1];
    } else if (__.nullValueSeparator=="top") {
        return [h()+1, 1+nullValueSeparatorPadding.bottom+nullValueSeparatorPadding.top];
    }
    return [h()+1, 1];
}



// attempt to determine types of each dimension based on first row of data
function detectDimensionTypes(data) {
    var types = {};
    console.log("in dimension types: ", data[0]);
    console.log(d3.keys(data[0]));
    d3.keys(data[0])
        .forEach(function(col) {
            types[isNaN(Number(col)) ? col : parseInt(col)] = toTypeCoerceNumbers(data[0][col]);
        });
    console.log(types);
    return types;
};

// try to coerce to number before returning type
function toTypeCoerceNumbers(v) {
    if ((parseFloat(v) == v) && (v != null)) {
        return "number";
    }
    return toType(v);
};

// a better "typeof" from this post:
// http://stackoverflow.com/questions/7390426/better-way-to-get-type-of-a-javascript-variable
function toType(v) {
  return ({}).toString.call(v).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

