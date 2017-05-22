'use strict';

const _ = require('lodash');
const paper = require('paper');

//
// Split the path into $count segments.  The path length between addjacent segments is uniform (equal to path.length 
// divided by $count).
//
function splitPathEvenly(originalPath, count) {
    // Use a clone of the original to make changes to, but use the $originalPath for offset and length calculations.
    var path = originalPath.clone({insert: false});

    var splitLen = originalPath.length / (1.0 * count);
    var pathLength = originalPath.length;

    var newSegments = [];

    for (var segmentIndex = 0; segmentIndex < originalPath.segments.length; ++segmentIndex) {
        var s0 = originalPath.segments[segmentIndex];
        var s1 = originalPath.segments[(segmentIndex + 1) % originalPath.segments.length];

        var originalSegmentDistance = originalPath.getOffsetOf(s1.point) - originalPath.getOffsetOf(s0.point);
        if (segmentIndex == originalPath.segments.length - 1) {
            originalSegmentDistance = originalPath.length - originalPath.getOffsetOf(s0.point);
        }

        var splitsPerSegment = Math.round(originalSegmentDistance / splitLen);
        var distancePerSplit = originalSegmentDistance / splitsPerSegment;
        var segmentStart = originalPath.getOffsetOf(s0.point);
        var splitCount = 0;

        while(splitCount < splitsPerSegment) {
            var currentOffset = (splitCount * distancePerSplit) + segmentStart;// + 0.001;
            try {
                // divideAt will not return anything if the division location is an existing segment!
                var r0 = path.divideAt(currentOffset);
                
                if (r0 == null) {
                    r0 = s0;
                }

                var seg = {
                    point: r0.point,
                    location: { normal: r0.location.normal },
                    offset: currentOffset,
                    handleIn: r0.handleIn,
                    handleOut: r0.handleOut,
                    isOriginal: splitCount == 0,
                    original: r0
                };

                if (splitCount == 0 && path.closed == true) {
                    var leftOffset = currentOffset - 0.001 * distancePerSplit;
                    var rightOffset = currentOffset + 0.001 * distancePerSplit;
                    if (leftOffset < 0.0) {
                        leftOffset += pathLength;
                    }

                    var leftNorm = originalPath.getNormalAt(leftOffset);
                    var rightNorm = originalPath.getNormalAt(rightOffset);

                    var norm = leftNorm.add(rightNorm).multiply(0.5);

                    seg.location = { normal: norm };
                }
                newSegments.push(seg);
            } catch (e) {
                console.log(e);
            }
            splitCount++;
        }

        if (segmentIndex == originalPath.segments.length - 1) {
            if (originalPath.closed == false) {
                newSegments.push(originalPath.segments[originalPath.segments.length - 1]);
            }
        }
    }

    return newSegments;
}


//
// For each curve in the path, divide the curve into $count smaller curves.
//
// TODO: merge "dividePath" and "splitPathEvenly"?
// 
function dividePath(originalPath, count) {
    var newSegments = [];
    var len = 0.0;

    for (var curveIndex = 0; curveIndex < originalPath.curves.length; ++curveIndex) {
        var curve = originalPath.curves[curveIndex];

        var t = 0.0;
        var step = 1.0 / (1.0 * count);
        var i = 0;

        while(i < count) {
            try {
                var t = i * 1.0 / count;
                var split = curve.getLocationAt(t * curve.length);

                var r0 = curve.segment1;
                if (split) r0 = split;

                var seg = {
                    point: r0.point,
                    location: { normal: curve.getNormalAt(t * curve.length) },
                    isOriginal: i == 0,
                    original: r0
                };

                if (i == 0 && originalPath.closed == true) {
                    var leftOffset = len - 0.0001 * originalPath.length;
                    var rightOffset = len + 0.0001 * originalPath.length;
                    if (leftOffset < 0.0) {
                        leftOffset += originalPath.length;
                    }

                    var leftNorm = originalPath.getNormalAt(leftOffset);
                    var rightNorm = originalPath.getNormalAt(rightOffset);

                    var norm = leftNorm.add(rightNorm).multiply(0.5);

                    seg.location = { normal: norm };
                }

                newSegments.push(seg);
            } catch (e) {
                console.log(e);
            }
            i++;
        }
        len += curve.length;

        if (curveIndex == originalPath.curves.length - 1) {
            if (originalPath.closed == false) {
                var seg = {
                    point: curve.segment2.point,
                    location: { normal: curve.segment2.location.normal },
                    isOriginal: false,
                    original: curve.segment2
                };
                newSegments.push(seg);
            }
        }
    }
    return newSegments;
}


//
// Create a fixed width "stroke" path from an input path(s).
//
// The stroke path is made by subdividing the original path, while attempting to preserve as much as the original
// curvature as possible.
//
function FixedWidthStroke(opts, item) {
    var thickness =  _.get(opts, 'thickness', 20.0);
    var splitCount = _.get(opts, "splitCount", 50);
    var direction = _.get(opts, "direction", "outer");

    var results = [];

    //
    // HACK: item must either contain paths or be a path itself.  Is there a better way to check this?
    // 
    var paths = []; 
    if (item.children) {
        paths = item.getItems({class: paper.Path, recursive: true});
    } else if (item.className === 'Path') {
        paths.push(item);
    }

    for (const path of paths) {
        var segments = dividePath(path, splitCount);

        var inner = new paper.Path();
        inner.remove();
        var outer = new paper.Path();
        outer.remove();

        for (var segmentIndex = 0; segmentIndex < segments.length; ++segmentIndex) {
            var prev = segments[segmentIndex == 0 ? segments.length - 1 : segmentIndex - 1];
            var curr = segments[segmentIndex];
            var next = segments[(segmentIndex + 1) % segments.length];

            inner.addSegment(curr);

            var _thickness = thickness;
            if (path.closed && curr.isOriginal) {
                var prevNormal = prev.location.normal.normalize();
                var nextNormal = next.location.normal.normalize();
                var t = prevNormal.getAngleInRadians(nextNormal) * 0.5;
                _thickness = thickness * (1.0 / Math.cos(t));
            }

            _thickness = (direction === 'outer') ? _thickness : -_thickness
            
            var outerTranslate = curr.location.normal.normalize().multiply(_thickness);

            var transform = new paper.Matrix();
            transform = transform.translate(outerTranslate);
            var outerSegment = new paper.Segment(curr.original);
            outerSegment.transform(transform);
            outer.addSegment(outerSegment);
        };

        if (path.closed) {
            var compoundPath = new paper.CompoundPath();
            compoundPath.remove();

            compoundPath.fillRule = 'evenodd';

            outer.addSegment(outer.segments[0]);

            compoundPath.addChild(outer);
            compoundPath.addChild(inner);
            results.push(compoundPath);
        } else {
            outer.addSegments(inner.segments.reverse());
            outer.addSegment(outer.segments[0]);

            outer.segments.forEach(s => {
                s.clearHandles();
            });

            outer.closed = path.closed;
            results.push(outer);
        }
    }

    var stroke = new paper.Group();
    stroke.addChildren(results);
    return stroke;
}

module.exports.SplitPathEvenly = splitPathEvenly;
module.exports.DividePath = dividePath;
module.exports.FixedWidthStroke = FixedWidthStroke;