import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey';
import { handleErrors } from '../common/utils';
var vis = {
    id: 'sankey',
    label: 'Sankey',
    options: {
        color_range: {
            type: 'array',
            label: 'Color Range',
            display: 'colors',
            default: ['#dd3333', '#80ce5d', '#f78131', '#369dc1', '#c572d3', '#36c1b3', '#b57052', '#ed69af']
        },
        label_type: {
            default: 'name',
            display: 'select',
            label: 'Label Type',
            type: 'string',
            values: [
                { 'Name': 'name' },
                { 'Name (value)': 'name_value' }
            ]
        },
        show_null_points: {
            type: 'boolean',
            label: 'Plot Null Values',
            default: true
        }
    },
    // Set up the initial state of the visualization
    create: function (element, config) {
        element.innerHTML = "\n      <style>\n      .node,\n      .link {\n        transition: 0.5s opacity;\n      }\n      </style>\n    ";
        this.svg = d3.select(element).append('svg');
    },
    // Render in response to the data or settings changing
    updateAsync: function (data, element, config, queryResponse, details, doneRendering) {
        if (!handleErrors(this, queryResponse, {
            min_pivots: 0, max_pivots: 0,
            min_dimensions: 2, max_dimensions: undefined,
            min_measures: 1, max_measures: 1
        }))
            return;
        var width = element.clientWidth;
        var height = element.clientHeight;
        var svg = this.svg
            .html('')
            .attr('width', '100%')
            .attr('height', '100%')
            .append('g');
        var dimensions = queryResponse.fields.dimension_like;
        var measure = queryResponse.fields.measure_like[0];
        //  The standard d3.ScaleOrdinal<string, {}>, causes error
        // `no-inferred-empty-object-type  Explicit type parameter needs to be provided to the function call`
        // https://stackoverflow.com/questions/31564730/typescript-with-d3js-with-definitlytyped
        var color = d3.scaleOrdinal()
            .range(config.color_range || vis.options.color_range.default);
        var defs = svg.append('defs');
        var sankeyInst = sankey()
            .nodeAlign(sankeyLeft)
            .nodeWidth(10)
            .nodePadding(12)
            .extent([[1, 1], [width - 1, height - 6]]);
        // TODO: Placeholder until @types catches up with sankey
        var newSankeyProps = sankeyInst;
        newSankeyProps.nodeSort(null);
        var link = svg.append('g')
            .attr('class', 'links')
            .attr('fill', 'none')
            .attr('stroke', '#fff')
            .selectAll('path');
        var node = svg.append('g')
            .attr('class', 'nodes')
            .attr('font-family', 'sans-serif')
            .attr('font-size', 10)
            .selectAll('g');
        var graph = {
            nodes: [],
            links: []
        };
        var nodes = d3.set();
        data.forEach(function (d) {
            // variable number of dimensions
            var path = [];
            for (var _i = 0, dimensions_1 = dimensions; _i < dimensions_1.length; _i++) {
                var dim = dimensions_1[_i];
                if (d[dim.name].value === null && !config.show_null_points)
                    break;
                path.push(d[dim.name].value + '');
            }
            path.forEach(function (p, i) {
                if (i === path.length - 1)
                    return;
                var source = path.slice(i, i + 1)[0] + i + "len:".concat(path.slice(i, i + 1)[0].length);
                var target = path.slice(i + 1, i + 2)[0] + (i + 1) + "len:".concat(path.slice(i + 1, i + 2)[0].length);
                nodes.add(source);
                nodes.add(target);
                // Setup drill links
                var drillLinks = [];
                for (var key in d) {
                    if (d[key].links) {
                        d[key].links.forEach(function (link) { drillLinks.push(link); });
                    }
                }
                graph.links.push({
                    'drillLinks': drillLinks,
                    'source': source,
                    'target': target,
                    'value': +d[measure.name].value
                });
            });
        });
        var nodesArray = nodes.values();
        graph.links.forEach(function (d) {
            d.source = nodesArray.indexOf(d.source);
            d.target = nodesArray.indexOf(d.target);
        });
        graph.nodes = nodes.values().map(function (d) {
            return {
                name: d.slice(0, d.split('len:')[1])
            };
        });
        sankeyInst(graph);
        link = link
            .data(graph.links)
            .enter().append('path')
            .attr('class', 'link')
            .attr('d', function (d) { return 'M' + -10 + ',' + -10 + sankeyLinkHorizontal()(d); })
            .style('opacity', 0.4)
            .attr('stroke-width', function (d) { return Math.max(1, d.width); })
            .on('mouseenter', function (d) {
            svg.selectAll('.link')
                .style('opacity', 0.05);
            d3.select(this)
                .style('opacity', 0.7);
            svg.selectAll('.node')
                .style('opacity', function (p) {
                if (p === d.source)
                    return 1;
                if (p === d.target)
                    return 1;
                return 0.5;
            });
        })
            .on('click', function (d) {
            // Add drill menu event
            var coords = d3.mouse(this);
            var event = { pageX: coords[0], pageY: coords[1] };
            LookerCharts.Utils.openDrillMenu({
                links: d.drillLinks,
                event: event
            });
        })
            .on('mouseleave', function (d) {
            d3.selectAll('.node').style('opacity', 1);
            d3.selectAll('.link').style('opacity', 0.4);
        });
        // gradients https://bl.ocks.org/micahstubbs/bf90fda6717e243832edad6ed9f82814
        link.style('stroke', function (d, i) {
            // make unique gradient ids
            var gradientID = 'gradient' + i;
            var startColor = color(d.source.name.replace(/ .*/, ''));
            var stopColor = color(d.target.name.replace(/ .*/, ''));
            var linearGradient = defs.append('linearGradient')
                .attr('id', gradientID);
            linearGradient.selectAll('stop')
                .data([
                { offset: '10%', color: startColor },
                { offset: '90%', color: stopColor }
            ])
                .enter().append('stop')
                .attr('offset', function (d) {
                return d.offset;
            })
                .attr('stop-color', function (d) {
                return d.color;
            });
            return 'url(#' + gradientID + ')';
        });
        node = node
            .data(graph.nodes)
            .enter().append('g')
            .attr('class', 'node')
            .on('mouseenter', function (d) {
            svg.selectAll('.link')
                .style('opacity', function (p) {
                if (p.source === d)
                    return 0.7;
                if (p.target === d)
                    return 0.7;
                return 0.05;
            });
        })
            .on('mouseleave', function (d) {
            d3.selectAll('.link').style('opacity', 0.4);
        });
        node.append('rect')
            .attr('x', function (d) { return d.x0; })
            .attr('y', function (d) { return d.y0; })
            .attr('height', function (d) { return Math.abs(d.y1 - d.y0); })
            .attr('width', function (d) { return Math.abs(d.x1 - d.x0); })
            .attr('fill', function (d) { return color(d.name.replace(/ .*/, '')); })
            .attr('stroke', '#555');
        node.append('text')
            .attr('x', function (d) { return d.x0 - 6; })
            .attr('y', function (d) { return (d.y1 + d.y0) / 2; })
            .attr('dy', '0.35em')
            .style('font-weight', 'bold')
            .attr('text-anchor', 'end')
            .style('fill', '#222')
            .text(function (d) {
            switch (config.label_type) {
                case 'name':
                    return d.name;
                case 'name_value':
                    return "".concat(d.name, " (").concat(d.value, ")");
                default:
                    return '';
            }
        })
            .filter(function (d) { return d.x0 < width / 2; })
            .attr('x', function (d) { return d.x1 + 6; })
            .attr('text-anchor', 'start');
        node.append('title')
            .text(function (d) { return d.name + '\n' + d.value; });
        doneRendering();
    }
};
looker.plugins.visualizations.add(vis);
