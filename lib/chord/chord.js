import * as d3 from 'd3';
import { formatType, handleErrors } from '../common/utils';
var defaultFormatter = function (x) { return x.toString(); };
var vis = {
    id: 'chord',
    label: 'Chord',
    options: {
        color_range: {
            type: 'array',
            label: 'Color Range',
            display: 'colors',
            default: ['#dd3333', '#80ce5d', '#f78131', '#369dc1', '#c572d3', '#36c1b3', '#b57052', '#ed69af']
        }
    },
    // Set up the initial state of the visualization
    create: function (element, config) {
        element.innerHTML = "\n      <style>\n        .chordchart circle {\n          fill: none;\n          pointer-events: all;\n        }\n\n        .chordchart:hover path.chord-fade {\n          display: none;\n        }\n\n        .groups text {\n          font-size: 12px;\n        }\n\n        .chordchart, .chord-tip {\n          font-family: \"Open Sans\", \"Helvetica\", sans-serif;\n        }\n\n        .chord-tip {\n          position: absolute;\n          top: 0;\n          left: 0;\n          z-index: 10;\n        }\n      </style>\n    ";
        this.tooltip = d3.select(element).append('div').attr('class', 'chord-tip');
        this.svg = d3.select(element).append('svg');
    },
    computeMatrix: function (data, dimensions, measure) {
        var indexByName = d3.map();
        var nameByIndex = d3.map();
        var matrix = [];
        var n = 0;
        // Compute a unique index for each package name.
        dimensions.forEach(function (dimension) {
            data.forEach(function (d) {
                var value = d[dimension].value;
                if (!indexByName.has(value)) {
                    nameByIndex.set(n.toString(), value);
                    indexByName.set(value, n++);
                }
            });
        });
        // Construct a square matrix
        for (var i = -1; ++i < n;) {
            matrix[i] = [];
            for (var t = -1; ++t < n;) {
                matrix[i][t] = 0;
            }
        }
        // Fill matrix
        data.forEach(function (d) {
            var row = indexByName.get(d[dimensions[1]].value);
            var col = indexByName.get(d[dimensions[0]].value);
            var val = d[measure].value;
            matrix[row][col] = val;
        });
        return {
            matrix: matrix,
            indexByName: indexByName,
            nameByIndex: nameByIndex
        };
    },
    // Render in response to the data or settings changing
    update: function (data, element, config, queryResponse) {
        var _this = this;
        if (!handleErrors(this, queryResponse, {
            min_pivots: 0, max_pivots: 0,
            min_dimensions: 2, max_dimensions: 2,
            min_measures: 1, max_measures: 1
        }))
            return;
        var dimensions = queryResponse.fields.dimension_like;
        var measure = queryResponse.fields.measure_like[0];
        // Set dimensions
        var width = element.clientWidth;
        var height = element.clientHeight;
        var thickness = 15;
        var outerRadius = Math.min(width, height) * 0.5;
        var innerRadius = outerRadius - thickness;
        // Stop if radius is < 0
        if (innerRadius < 0)
            return;
        var valueFormatter = formatType(measure.value_format) || defaultFormatter;
        var tooltip = this.tooltip;
        // Set color scale
        var colorScale = d3.scaleOrdinal();
        if (config.color_range == null || !(/^#/).test(config.color_range[0])) {
            // Workaround for Looker bug where we don't get custom colors.
            config.color_range = this.options.color_range.default;
        }
        var color = colorScale.range(config.color_range);
        // Set chord layout
        var chord = d3.chord()
            .padAngle(0.025)
            .sortSubgroups(d3.descending)
            .sortChords(d3.descending);
        // Create ribbon generator
        var ribbon = d3.ribbon()
            .radius(innerRadius);
        // Create arc generator
        var arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);
        // Turn data into matrix
        var matrix = this.computeMatrix(data, dimensions.map(function (d) { return d.name; }), measure.name);
        // draw
        var svg = this.svg
            .html('')
            .attr('width', '100%')
            .attr('height', '100%')
            .append('g')
            .attr('class', 'chordchart')
            .attr('transform', 'translate(' + width / 2 + ',' + (height / 2) + ')')
            .datum(chord(matrix.matrix));
        svg.append('circle')
            .attr('r', outerRadius);
        var ribbons = svg.append('g')
            .attr('class', 'ribbons')
            .selectAll('path')
            .data(function (chords) { return chords; })
            .enter().append('path')
            .style('opacity', 0.8)
            .attr('d', ribbon)
            .style('fill', function (d) { return color(d.target.index); })
            .style('stroke', function (d) { return d3.rgb(color(d.index)).darker(); })
            .on('mouseenter', function (d) {
            tooltip.html(_this.titleText(matrix.nameByIndex, d.source, d.target, valueFormatter));
        })
            .on('mouseleave', function (d) { return tooltip.html(''); });
        var group = svg.append('g')
            .attr('class', 'groups')
            .selectAll('g')
            .data(function (chords) { return chords.groups; })
            .enter().append('g')
            .on('mouseover', function (d, i) {
            ribbons.classed('chord-fade', function (p) {
                return (p.source.index !== i
                    && p.target.index !== i);
            });
        });
        var groupPath = group.append('path')
            .style('opacity', 0.8)
            .style('fill', function (d) { return color(d.index); })
            .style('stroke', function (d) { return d3.rgb(color(d.index)).darker(); })
            .attr('id', function (d, i) { return "group".concat(i); })
            .attr('d', arc);
        var groupPathNodes = groupPath.nodes();
        var groupText = group.append('text').attr('dy', 11);
        groupText.append('textPath')
            .attr('xlink:href', function (d, i) { return "#group".concat(i); })
            .attr('startOffset', function (d, i) { return (groupPathNodes[i].getTotalLength() - (thickness * 2)) / 4; })
            .style('text-anchor', 'middle')
            .text(function (d) { return matrix.nameByIndex.get(d.index.toString()); });
        // Remove the labels that don't fit. :(
        groupText
            .filter(function (d, i) {
            return groupPathNodes[i].getTotalLength() / 2 - 16 < this.getComputedTextLength();
        })
            .remove();
    },
    titleText: function (lookup, source, target, formatter) {
        var sourceName = lookup.get(source.index);
        var sourceValue = formatter(source.value);
        var targetName = lookup.get(target.index);
        var targetValue = formatter(target.value);
        return "\n      <p>".concat(sourceName, " \u2192 ").concat(targetName, ": ").concat(sourceValue, "</p>\n      <p>").concat(targetName, " \u2192 ").concat(sourceName, ": ").concat(targetValue, "</p>\n    ");
    }
};
looker.plugins.visualizations.add(vis);
