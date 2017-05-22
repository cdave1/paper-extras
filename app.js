'use strict';

const path = require('path');
const fs = require('fs');

const _ = require('lodash');
const paper = require('paper-jsdom-canvas');

const extras = require('./index.js');

const PAPER_CANVAS_WIDTH =  1024.0;
const PAPER_CANVAS_HEIGHT = 1024.0;

var paperCanvas = new paper.PaperScope();
paperCanvas.setup(new paper.Size(PAPER_CANVAS_WIDTH, PAPER_CANVAS_HEIGHT));
paperCanvas.project.clear();
paperCanvas.activate();

var arc = new paper.Path.Arc(new paper.Point(200, 200), new paper.Point(600, 600), new paper.Point(1000, 200));
var circle = new paper.Path.Circle(new paper.Point(500, 500), 100);

var _arc = extras.FixedWidthStroke({}, arc);
var _circle = extras.FixedWidthStroke({thickness: 100.0}, circle);

_circle.fillColor = '#EEE';
_circle.strokeColor = '#39C';
_circle.strokeWidth = 5;

_arc.fillColor = '#EEE';
_arc.strokeColor = '#39C';
_arc.strokeWidth = 5;

paperCanvas.project.activeLayer.addChild(_arc);
paperCanvas.project.activeLayer.addChild(_circle);


var raster = paperCanvas.project.activeLayer.rasterize(24, false);
var pngBase64 = raster.toDataURL();
const header = "data:image/png;base64,";
pngBase64 = _.replace(pngBase64, header, '');
var buf = Buffer.from(pngBase64, 'base64');
fs.writeFileSync(path.join(__dirname, "output.png"), buf);
