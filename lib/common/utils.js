import * as d3 from 'd3';
export var formatType = function (valueFormat) {
    if (!valueFormat)
        return undefined;
    var format = '';
    switch (valueFormat.charAt(0)) {
        case '$':
            format += '$';
            break;
        case '£':
            format += '£';
            break;
        case '€':
            format += '€';
            break;
    }
    if (valueFormat.indexOf(',') > -1) {
        format += ',';
    }
    var splitValueFormat = valueFormat.split('.');
    format += '.';
    format += splitValueFormat.length > 1 ? splitValueFormat[1].length : 0;
    switch (valueFormat.slice(-1)) {
        case '%':
            format += '%';
            break;
        case '0':
            format += 'f';
            break;
    }
    return d3.format(format);
};
export var handleErrors = function (vis, res, options) {
    var check = function (group, noun, count, min, max) {
        if (!vis.addError || !vis.clearErrors)
            return false;
        if (count < min) {
            vis.addError({
                title: "Not Enough ".concat(noun, "s"),
                message: "This visualization requires ".concat(min === max ? 'exactly' : 'at least', " ").concat(min, " ").concat(noun.toLowerCase()).concat(min === 1 ? '' : 's', "."),
                group: group
            });
            return false;
        }
        if (count > max) {
            vis.addError({
                title: "Too Many ".concat(noun, "s"),
                message: "This visualization requires ".concat(min === max ? 'exactly' : 'no more than', " ").concat(max, " ").concat(noun.toLowerCase()).concat(min === 1 ? '' : 's', "."),
                group: group
            });
            return false;
        }
        vis.clearErrors(group);
        return true;
    };
    var _a = res.fields, pivots = _a.pivots, dimensions = _a.dimensions, measures = _a.measure_like;
    return (check('pivot-req', 'Pivot', pivots.length, options.min_pivots, options.max_pivots)
        && check('dim-req', 'Dimension', dimensions.length, options.min_dimensions, options.max_dimensions)
        && check('mes-req', 'Measure', measures.length, options.min_measures, options.max_measures));
};
