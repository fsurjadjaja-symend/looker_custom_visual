import * as d3 from 'd3';
import { formatType, handleErrors } from '../common/utils';
// recursively create children array
function descend(obj, depth) {
    if (depth === void 0) { depth = 0; }
    var arr = [];
    for (var k in obj) {
        if (k === '__data') {
            continue;
        }
        var child = {
            name: k,
            depth: depth,
            children: descend(obj[k], depth + 1)
        };
        if ('__data' in obj[k]) {
            child.data = obj[k].__data;
        }
        arr.push(child);
    }
    return arr;
}
function burrow(table) {
    // create nested object
    var obj = {};
    table.forEach(function (row) {
        // start at root
        var layer = obj;
        // create children as nested objects
        row.taxonomy.value.forEach(function (key) {
            layer[key] = key in layer ? layer[key] : {};
            layer = layer[key];
        });
        layer.__data = row;
    });
    // use descend to create nested children arrays
    return {
        name: 'root',
        children: descend(obj, 1),
        depth: 0
    };
}
var vis = {
    id: 'treemap',
    label: 'Treemap',
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
        this.svg = d3.select(element).append('svg');
    },
    // Render in response to the data or settings changing
    update: function (data, element, config, queryResponse) {
        if (!handleErrors(this, queryResponse, {
            min_pivots: 0, max_pivots: 0,
            min_dimensions: 1, max_dimensions: undefined,
            min_measures: 1, max_measures: 1
        }))
            return;
        var width = element.clientWidth;
        var height = element.clientHeight;
        var dimensions = queryResponse.fields.dimension_like;
        var measure = queryResponse.fields.measure_like[0];
        var format = formatType(measure.value_format) || (function (s) { return s.toString(); });
        var colorScale = d3.scaleOrdinal();
        var color = colorScale.range(config.color_range);
        data.forEach(function (row) {
            row.taxonomy = {
                value: dimensions.map(function (dimension) { return row[dimension.name].value; })
            };
        });
        var treemap = d3.treemap()
            .size([width, height - 16])
            .tile(d3.treemapSquarify.ratio(1))
            .paddingOuter(1)
            .paddingTop(function (d) {
            return d.depth === 1 ? 16 : 0;
        })
            .paddingInner(1)
            .round(true);
        var svg = this.svg
            .html('')
            .attr('width', '100%')
            .attr('height', '100%')
            .append('g')
            .attr('transform', 'translate(0,16)');
        var breadcrumb = svg.append('text')
            .attr('y', -5)
            .attr('x', 4);
        var root = d3.hierarchy(burrow(data)).sum(function (d) {
            return 'data' in d ? d.data[measure.name].value : 0;
        });
        treemap(root);
        var cell = svg.selectAll('.node')
            .data(root.descendants())
            .enter().append('g')
            .attr('transform', function (d) { return 'translate(' + d.x0 + ',' + d.y0 + ')'; })
            .attr('class', function (d, i) { return 'node depth-' + d.depth; })
            .style('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .on('click', function (d) { return console.log(d); })
            .on('mouseenter', function (d) {
            var ancestors = d.ancestors();
            breadcrumb.text(ancestors.map(function (p) { return p.data.name; })
                .slice(0, -1)
                .reverse()
                .join('-') + ': ' + format(d.value));
            svg.selectAll('g.node rect')
                .style('stroke', null)
                .filter(function (p) { return ancestors.indexOf(p) > -1; })
                .style('stroke', '#fff');
        })
            .on('mouseleave', function (d) {
            breadcrumb.text('');
            svg.selectAll('g.node rect')
                .style('stroke', function (d) {
                return null;
            });
        });
        cell.append('rect')
            .attr('id', function (d, i) { return 'rect-' + i; })
            .attr('width', function (d) { return d.x1 - d.x0; })
            .attr('height', function (d) { return d.y1 - d.y0; })
            .style('fill', function (d) {
            if (d.depth === 0)
                return 'none';
            var ancestor = d.ancestors().map(function (p) { return p.data.name; }).slice(-2, -1)[0];
            var colors = [color(ancestor), '#ddd'];
            var scale = d3.scaleLinear()
                .domain([1, 6.5])
                .range(colors);
            return scale(d.depth);
        });
        cell.append('clipPath')
            .attr('id', function (d, i) { return 'clip-' + i; })
            .append('use')
            .attr('xlink:href', function (d, i) { return '#rect-' + i; });
        cell.append('text')
            .style('opacity', function (d) {
            if (d.depth === 1)
                return 1;
            return 0;
        })
            .attr('clip-path', function (d, i) { return 'url(#clip-' + i + ')'; })
            .attr('y', function (d) {
            return d.depth === 1 ? '13' : '10';
        })
            .attr('x', 2)
            .style('font-family', 'Helvetica, Arial, sans-serif')
            .style('fill', 'white')
            .style('font-size', function (d) {
            return d.depth === 1 ? '14px' : '10px';
        })
            .text(function (d) { return d.data.name === 'root' ? '' : d.data.name; });
    }
};
looker.plugins.visualizations.add(vis);
