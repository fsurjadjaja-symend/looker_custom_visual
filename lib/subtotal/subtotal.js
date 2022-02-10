import * as $ from 'jquery';
import 'pivottable';
import subtotalMultipleAggregates from 'subtotal-multiple-aggregates';
import { handleErrors, formatType } from '../common/utils';
var themeClassic = require('subtotal-multiple-aggregates/dist/looker-classic.css');
var themeWhite = require('subtotal-multiple-aggregates/dist/looker-white.css');
var defaultFormatter = function (x) { return x.toString(); };
var LOOKER_ROW_TOTAL_KEY = '$$$_row_total_$$$';
subtotalMultipleAggregates($);
var vis = {
    id: 'subtotal',
    label: 'Subtotal',
    options: {
        theme: {
            type: 'string',
            label: 'Theme',
            display: 'select',
            values: [
                { 'Classic': 'classic' },
                { 'White': 'white' }
            ],
            default: 'classic'
        },
        show_full_field_name: {
            type: 'boolean',
            label: 'Show Full Field Name',
            default: true
        }
    },
    create: function (element, config) {
        this.style = document.createElement('style');
        document.head.appendChild(this.style);
    },
    update: function (data, element, config, queryResponse, details) {
        if (!config || !data)
            return;
        if (details && details.changed && details.changed.size)
            return;
        if (!this.style)
            return;
        if (!handleErrors(this, queryResponse, {
            min_pivots: 0, max_pivots: Infinity,
            min_dimensions: 1, max_dimensions: Infinity,
            min_measures: 1, max_measures: Infinity
        }))
            return;
        var theme = config.theme || this.options.theme.default;
        switch (theme) {
            case 'classic':
                this.style.innerHTML = themeClassic.toString();
                break;
            case 'white':
                this.style.innerHTML = themeWhite.toString();
                break;
            default:
                throw new Error("Unknown theme: ".concat(theme));
        }
        var pivots = queryResponse.fields.pivots.map(function (d) { return d.name; });
        var dimensions = queryResponse.fields.dimensions.map(function (d) { return d.name; });
        var measures = queryResponse.fields.measures;
        var labels = {};
        for (var _i = 0, _a = Object.keys(config.query_fields); _i < _a.length; _i++) {
            var key = _a[_i];
            var obj = config.query_fields[key];
            for (var _b = 0, obj_1 = obj; _b < obj_1.length; _b++) {
                var field = obj_1[_b];
                var name_1 = field.name, label1 = field.view_label, label2 = field.label_short;
                labels[name_1] = config.show_full_field_name ? { label: label1, sublabel: label2 } : { label: label2 };
            }
        }
        var pivotSet = {};
        for (var _c = 0, pivots_1 = pivots; _c < pivots_1.length; _c++) {
            var pivot = pivots_1[_c];
            pivotSet[pivot] = true;
        }
        var htmlForCell = function (cell) {
            return cell.html ? LookerCharts.Utils.htmlForCell(cell) : cell.value;
        };
        var ptData = [];
        for (var _d = 0, data_1 = data; _d < data_1.length; _d++) {
            var row = data_1[_d];
            var ptRow = {};
            for (var _e = 0, _f = Object.keys(row); _e < _f.length; _e++) {
                var key = _f[_e];
                var cell = row[key];
                if (pivotSet[key])
                    continue;
                var cellValue = htmlForCell(cell);
                ptRow[key] = cellValue;
            }
            if (pivots.length === 0) {
                // No pivoting, just add each data row.
                ptData.push(ptRow);
            }
            else {
                // Fan out each row using the pivot. Multiple pivots are joined by `|FIELD|`.
                for (var _g = 0, _h = Object.keys(row[measures[0].name]); _g < _h.length; _g++) {
                    var flatKey = _h[_g];
                    var pivotRow = Object.assign({}, ptRow);
                    if (flatKey === LOOKER_ROW_TOTAL_KEY) {
                        for (var _j = 0, _k = Object.keys(row[measures[0].name]); _j < _k.length; _j++) {
                            var pivotKey = _k[_j];
                            for (var _l = 0, pivots_2 = pivots; _l < pivots_2.length; _l++) {
                                var pivot = pivots_2[_l];
                                pivotRow[pivot] = LOOKER_ROW_TOTAL_KEY;
                            }
                            for (var _m = 0, measures_1 = measures; _m < measures_1.length; _m++) {
                                var measure = measures_1[_m];
                                var cell = row[measure.name][pivotKey];
                                var cellValue = htmlForCell(cell);
                                pivotRow[measure.name] = cellValue;
                            }
                        }
                    }
                    else {
                        var pivotValues = flatKey.split(/\|FIELD\|/g);
                        for (var i = 0; i < pivots.length; i++) {
                            pivotRow[pivots[i]] = pivotValues[i];
                        }
                        for (var _o = 0, measures_2 = measures; _o < measures_2.length; _o++) {
                            var measure = measures_2[_o];
                            var cell = row[measure.name][flatKey];
                            var cellValue = htmlForCell(cell);
                            pivotRow[measure.name] = cellValue;
                        }
                    }
                    ptData.push(pivotRow);
                }
            }
        }
        // We create our own aggregators instead of using
        // $.pivotUtilities.aggregators because we want to use our own configurable
        // number formatter for some of them.
        var tpl = $.pivotUtilities.aggregatorTemplates;
        var intFormat = formatType('###,###,###,##0');
        var aggregatorNames = [];
        var aggregators = [];
        for (var i = 0; i < measures.length; i++) {
            var _p = measures[i], type = _p.type, name_2 = _p.name, value_format = _p.value_format, label1 = _p.view_label, label2 = _p.label_short;
            var customFormat = formatType(value_format) || defaultFormatter;
            var agg = void 0;
            switch (type) {
                case 'count':
                    agg = tpl.sum(intFormat);
                    break;
                case 'count_distinct':
                    agg = tpl.sum(intFormat);
                    break;
                case 'sum':
                    agg = tpl.sum(customFormat);
                    break;
                case 'sum_distinct':
                    agg = tpl.sum(customFormat);
                    break;
                case 'average':
                    agg = tpl.average(customFormat);
                    break;
                case 'median':
                    agg = tpl.median(customFormat);
                    break;
                case 'min':
                    agg = tpl.min(customFormat);
                    break;
                case 'max':
                    agg = tpl.max(customFormat);
                    break;
                case 'list':
                    agg = tpl.listUnique(', ');
                    break;
                case 'percent_of_total':
                    agg = tpl.fractionOf(tpl.sum(), 'total', customFormat);
                    break;
                case 'int':
                    agg = tpl.sum(intFormat);
                    break;
                case 'number':
                    agg = tpl.sum(customFormat);
                    break;
                default:
                    if (this && this.clearErrors && this.addError) {
                        this.clearErrors('measure-type');
                        this.addError({
                            group: 'measure-type',
                            title: "Cannot Show \"".concat(label1, " ").concat(label2, "\""),
                            message: "Measure types of '".concat(type, "' are unsupported by this visualization.")
                        });
                    }
                    return;
            }
            var aggName = "measure_".concat(i);
            labels[aggName] = config.show_full_field_name ? { label: label1, sublabel: label2 } : { label: label2 };
            aggregatorNames.push(aggName);
            aggregators.push(agg([name_2]));
        }
        var numericSortAsc = function (a, b) { return a - b; };
        var numericSortDesc = function (a, b) { return b - a; };
        var stringSortAsc = function (a, b) { return (a === LOOKER_ROW_TOTAL_KEY ? Infinity :
            b === LOOKER_ROW_TOTAL_KEY ? -Infinity :
                String(a).localeCompare(b)); };
        var stringSortDesc = function (a, b) { return (a === LOOKER_ROW_TOTAL_KEY ? Infinity :
            b === LOOKER_ROW_TOTAL_KEY ? -Infinity :
                String(b).localeCompare(a)); };
        var sorters = {};
        for (var _q = 0, _r = ['measure_like', 'dimension_like', 'pivots']; _q < _r.length; _q++) {
            var fieldType = _r[_q];
            for (var _s = 0, _t = queryResponse.fields[fieldType]; _s < _t.length; _s++) {
                var field = _t[_s];
                if (field.sorted != null) {
                    if (field.is_numeric) {
                        sorters[field.name] = field.sorted.desc ? numericSortDesc : numericSortAsc;
                    }
                    else {
                        sorters[field.name] = field.sorted.desc ? stringSortDesc : stringSortAsc;
                    }
                }
            }
        }
        var dataClass = $.pivotUtilities.SubtotalPivotDataMulti;
        var renderer = $.pivotUtilities.subtotal_renderers['Table With Subtotal'];
        var rendererOptions = {
            arrowExpanded: '▼',
            arrowCollapsed: '▶'
        };
        var options = {
            rows: dimensions,
            cols: pivots,
            labels: labels,
            dataClass: dataClass,
            renderer: renderer,
            rendererOptions: rendererOptions,
            aggregatorNames: aggregatorNames,
            aggregators: aggregators,
            sorters: sorters,
            hasColTotals: queryResponse.has_totals,
            hasRowTotals: queryResponse.has_row_totals
        };
        $(element).pivot(ptData, options);
    }
};
looker.plugins.visualizations.add(vis);
