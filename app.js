$(document).ready(function() {
    if(window.localStorage.getItem("welcomed") === "true") {
        $('.open-file').hide();
        $('#row-hide').hide();
    }

    if(window.localStorage.getItem("fastmode") === "true") {
        fastMode = true;
    }

    if(window.localStorage.getItem("colormap") !== undefined) {
        colorMap = JSON.parse(window.localStorage.getItem("colormap"));
    }   

    $('#dismiss-button').click(function(ev) {
        ev.stopPropagation();

        window.localStorage.setItem("welcomed", true);
        $('.open-file').fadeOut(200, function() {
            $('#row-hide').hide();   
        });
    });

    $('#open-button').click(function(ev) {
        $('#open-modal').openModal(); 
    });

    $('#display-btn').click(function(ev) {
        ev.stopPropagation();

        var file = $('#file');
        $('#open-modal').closeModal();
        showSpinner();
        parseCSV(file);
    });

    $('#setttings-button').click(function(ev) {
        ev.stopPropagation();

        showSettings();
    });

    $('#save-btn').click(function(ev) {
        ev.stopPropagation();

        var color = $('input:radio[name=color-scheme]').filter(":checked").val();
        $('#settings-modal').closeModal();

        setColorScheme(color);
        var fmode = $('#fastmode').is(':checked');

        window.localStorage.setItem("fastmode", fmode);
        fastMode = fmode;
    });

});

var fastMode = false;
var colorMap = ["#2D7B86", "#DB8E47", "#DB5147"];

function setScheme(col1, col2, col3) {
    colorMap = [col1, col2, col3];
    window.localStorage.setItem("colormap", JSON.stringify(colorMap));

    redraw();
}

function setColorScheme(scheme) {
    switch(parseInt(scheme)) {
        case 1:
            setScheme("#2D7B86", "#DB8E47", "#DB5147");
            break;

        case 2:
            setScheme("#0000bd", "#a7ff58", "#840000");
            break;

        case 3:
            setScheme("#ffffff", "#ff7f00", "#2F0000");
            break;

        case 4:
            setScheme("#00ffff", "#7788ff", "#ff00ff");
            break;
    }
}

function showSettings() {
    $('#settings-modal').openModal();    
}

function showSpinner() {
    $('#spinner').css('visibility', 'visible');
    $('.valign-wrapper').css('display', '');
}

function hideSpinner() {
    $('#spinner').css('visibility', 'hidden');
    $('.valign-wrapper').css('display', 'none');
}

var queue = {
    _timer: null,
    _queue: [],
    add: function(fn, context, time) {
    var setTimer = function(time) {
        queue._timer = setTimeout(function() {
            time = queue.add();
            if (queue._queue.length) {
                setTimer(time);
            }
        }, time || 1);
    }

    if (fn) {
        queue._queue.push([fn, context, time]);
        if (queue._queue.length == 1) {
            setTimer(time);
        }
        return;
    }

    var next = queue._queue.shift();
    if (!next) {
        return 0;
    }
    next[0].call(next[1] || window);
    return next[2];
},
clear: function() {
    clearTimeout(queue._timer);
    queue._queue = [];
}
};

$.fn.redraw = function(){
      $(this).each(function(){
              var redraw = this.offsetHeight;
                });
};

var numItems = 0;
function updateLoadState() {

    $('#load-state').text("Loaded " + numItems + " datapoints.");
    $('#load-state').redraw();

    numItems++;
}

function clearLoadState() {
    $('#load-state').text("");
}

function parseCSV(file) {
    img = [];
    numItems = 0;
    minDb = null;
    maxDb = null;
    freqMin = null;
    freqMax = null;
    sweep = [];
    lastTime = null;
    curSamps = [];
    freqs = [];
    
    Papa.parse(file.prop('files')[0], {
        worker: false,
        skipEmptyLines: true,
        step: function(result) {
            var data = result.data;
            var self = this, doBind = function() {
                updateLoadState();
                handleSamples(data);
            };

            if(!fastMode) {
                queue.add(doBind, this);
            } else {
                doBind();
            }

        },
        complete: function() {
            var self = this, doBind = function() {
                clearLoadState();
                checkSingle();
                drawAll();
                hideSpinner();
           
                $('#export-button').attr('href', canvas.toDataURL("image/png"));
            };
            
            if(!fastMode) {
                queue.add(doBind, this);
            } else {
                doBind();
            }

            var $panzoom = $('.panzoom').panzoom();

            $panzoom.parent().on('mousewheel.focal', function( e ) {
                e.preventDefault();
                var delta = e.delta || e.originalEvent.wheelDelta;
                var zoomOut = delta ? delta < 0 : e.originalEvent.deltaY > 0;
                $panzoom.panzoom('zoom', zoomOut, {
                    increment: 0.1,
                    animate: false,
                    focal: e
                });
           });

       }
    });
}

var lastTime = null;
var curSamps = [];
var freqMin = null;
var freqMax = null;
var freqs = [];

function sort(array){
    var keys = new Array();
    var value = {};

    for (var elem in array){
        keys.push(elem);
    }

    keys.sort();
    
    for (var elem in keys){
        value[keys[elem]] = array[keys[elem]];
    }

    return value;
}

var sweep = [];

function handleSamples(dat) {
    var data = dat[0];
    var time = data[0] + data[1].replace(' ', 'T') + "Z";
    var ptime = new Date(time);

    var curMin = parseInt(data[2]);
    var curMax = parseInt(data[3]);
    var step = parseInt(data[4]);
    var numSamps = data[5];
    
    // check if a new sweep has started
    if(lastTime != null && +ptime != +lastTime) {
        // clone sweep and add it to the image
        img.push(sweep.slice(0));
        sweep = [];
        lastTime = null;
        curSamps = [];
    }

    lastTime = ptime;

    if(freqMin === null || curMin < freqMin) {
        freqMin = curMin;
    }

    if(freqMax === null || curMax > freqMax) {
        freqMax = curMax;
    }

    for(var i = 6; i < data.length; i++) {
        var db = parseFloat(String(data[i]).replace(' ', '').replace('-', ''));
        sweep.push(db);

        if(maxDb === null || (100-db) > maxDb) {
            maxDb = 100-db;
        }

        if(minDb === null || (100-db) < minDb) {
            minDb = 100-db;
        }
    }
}

function checkSingle() {
    if(sweep.length > 0) {
        img.push(sweep.slice(0));
        sweep = [];
        lastTime = null;
        curSamps = [];
    }
}

var canvas = null;
var ctx = null;
var pntWidth = 0;
var pntHeight = 0;
var img = [];

var maxDb = null;
var minDb = null;

var drawed = false;

function drawAll() {
    drawed = true;

    canvas = document.getElementById('spectrum');
    var height = img.length;
    var scaleH = 1;

    if(height > 16000) {
        while((height/scaleH) > 16000) {
             scaleH *= 2;
        }
    }   

    if(height == 0) {
        toast('The image was empty or an unknown error occured.', 4000);
        return;
    }   

    var width = img[0].length;
    var scaleW = 1;

    if(width > 16000) {
        while((width/scaleW) > 16000) {
             scaleW *= 2;
        }
    }

    width = width/scaleW;
    height = height/scaleH;

    var pph = Math.max(Math.round(canvas.height/height), 1);
    var ppw = Math.max(Math.round(canvas.width/width), 1);

    $(canvas).height(pph*height);
    $(canvas).width(ppw*width);

    canvas.height = pph*height;
    canvas.width = ppw*width;

    ctx = canvas.getContext('2d');
    ctx.scale(1, 1);
    ctx.save();

    console.log("[Rendering image] minFreq: " + freqMin + ", maxFreq: " + freqMax + ", width: " + width + ", height: " + height + ", PpH: " + pph + ", PpW: "+ ppw);
    console.log("min db: "+ minDb + ", max db: " + maxDb);

    var scale = chroma.scale(colorMap);

    for(var y = 0; y < height; y++) {
        for(var x = 0; x < width; x++) {
            var db = Math.round(img[y][x]);
            var dbP = ((100-db)-minDb)/(maxDb-minDb);
            var color = scale(dbP).hex();
            ctx.fillStyle = color;
            ctx.fillRect(x*ppw, y*pph, ppw, pph);
        }
    }

    drawLabels(canvas.width);

    ctx.restore();
}

var numLabels = 10;

function formatFreq(freq) {
    if(freq > 1e6) {
        return (parseInt(freq)/1e6).toFixed(2) + "M";
    } else if(freq > 1e3) {
        return (parseInt(freq)/1e3).toFixed(2) + "k";
    } else {
        return freq;
    }
}

function drawLabels(width) {
    var step = width/numLabels;
    var frqStep = (freqMax-freqMin)/numLabels;
    
    for(var i = 0; i <= numLabels; i++) {
        var frq = frqStep*i;

        ctx.font="14px Georgia";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(formatFreq(frq+freqMin),Math.round(step*i),10);
    }
}

function redraw() {
    if(!drawed) {
        return;
    }

    drawAll();
}
