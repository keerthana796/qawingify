var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010125657,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126701,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126702,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126703,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126704,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126706,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126710,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126711,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126712,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126713,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126713,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126726,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010126727,
                "type": ""
            }
        ],
        "screenShotFile": "0004007c-0004-00cc-009a-00ca0033008d.png",
        "timestamp": 1615010123310,
        "duration": 3511
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127755,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127786,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127786,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127786,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127788,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127801,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127801,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127802,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127810,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127811,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127811,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010127812,
                "type": ""
            }
        ],
        "screenShotFile": "00ec00d5-00b5-00a5-0084-00aa0006009c.png",
        "timestamp": 1615010127360,
        "duration": 474
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b50084-0084-0000-003d-000900280009.png",
        "timestamp": 1615010128176,
        "duration": 244
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ce00ee-0080-0026-0089-009b00f700b1.png",
        "timestamp": 1615010128854,
        "duration": 686
    },
    {
        "description": "verify if we login and by clicking on back button the username and password must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010130951,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010130952,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010130975,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010130975,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010130982,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010130982,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010131000,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010131000,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010131000,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010131004,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010131004,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010131004,
                "type": ""
            }
        ],
        "screenShotFile": "00470028-00b3-00ea-0079-008b00860080.png",
        "timestamp": 1615010129941,
        "duration": 1381
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010132073,
                "type": ""
            }
        ],
        "screenShotFile": "00bd0012-00d6-005d-0061-008b00d00050.png",
        "timestamp": 1615010131761,
        "duration": 430
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005f00b6-0032-00d7-0055-000200210095.png",
        "timestamp": 1615010132579,
        "duration": 193
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: browser.actions.mouseDown is not a function"
        ],
        "trace": [
            "TypeError: browser.actions.mouseDown is not a function\n    at sakshin.facebook (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:52:25)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:62:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"verify if the hand pointer clicks on facebook\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:61:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ca005a-00aa-002e-00de-00ab005900e2.png",
        "timestamp": 1615010133297,
        "duration": 159
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7912,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155374,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155824,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155825,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155862,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155878,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155884,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155887,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155893,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155894,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155894,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010155900,
                "type": ""
            }
        ],
        "screenShotFile": "00440043-0080-00ac-005b-003e00d6000e.png",
        "timestamp": 1615010153314,
        "duration": 2643
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7912,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010156879,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010156881,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010156933,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010156933,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010156934,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010156934,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010156935,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010156935,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010156936,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010157002,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010157034,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010157035,
                "type": ""
            }
        ],
        "screenShotFile": "0022007e-00dc-0041-00d0-003600f600f3.png",
        "timestamp": 1615010156479,
        "duration": 556
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7912,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0012000d-0016-000c-00a8-00e800a400de.png",
        "timestamp": 1615010157448,
        "duration": 259
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7912,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ab0040-00bc-0010-0064-002800c9005d.png",
        "timestamp": 1615010158088,
        "duration": 271
    },
    {
        "description": "verify if we login and by clicking on back button the username and password must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7912,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159221,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159222,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159251,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159252,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159252,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159252,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159256,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159257,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159257,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159258,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159258,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010159267,
                "type": ""
            }
        ],
        "screenShotFile": "009b0054-008a-00dc-001f-0037002a00ed.png",
        "timestamp": 1615010158729,
        "duration": 797
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7912,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010160148,
                "type": ""
            }
        ],
        "screenShotFile": "00490068-00ca-009b-0059-00f5008d00c7.png",
        "timestamp": 1615010159846,
        "duration": 381
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7912,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00cc0016-00d0-004d-0041-002600b700e6.png",
        "timestamp": 1615010160607,
        "duration": 191
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7912,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00480074-005d-0016-008b-00ee006e00d4.png",
        "timestamp": 1615010161151,
        "duration": 163
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(css selector, input[id=\"username\"])"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"username\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:12:19)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify with a valid login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:6:1)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "000a0053-0083-005f-0013-00df00e80004.png",
        "timestamp": 1615010371804,
        "duration": 23257
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(css selector, input[id=\"username\"])"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"username\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:20:18)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify if enter key works as a substitute for loginbtn\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:19:1)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a5001d-0013-00ad-002f-0066003b00b5.png",
        "timestamp": 1615010395484,
        "duration": 230
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(css selector, input[id=\"password\"])"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"password\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:27:18)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify if username is not entered it should shown an toast message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:26:2)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "007700c4-00d4-007d-0062-0004003c0027.png",
        "timestamp": 1615010396115,
        "duration": 223
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(css selector, input[id=\"username\"])"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"username\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:32:19)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify if the password is not entered it should shown an toast message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:31:2)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "007200cd-00c8-001a-00d9-000300160009.png",
        "timestamp": 1615010396719,
        "duration": 127
    },
    {
        "description": "verify if we login and by clicking on back button the username and password must be retained|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(css selector, input[id=\"username\"])"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"username\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:37:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify if we login and by clicking on back button the username and password must be retained\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:36:2)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "006e003a-00a3-0028-006e-002900c100f3.png",
        "timestamp": 1615010397258,
        "duration": 212
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(xpath, /html/body/div/div/div[1]/a/img)"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/div[1]/a/img)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:51:18)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify if we click on logo 404 page loads\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:50:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00aa005e-0064-00cb-00b0-009b00390017.png",
        "timestamp": 1615010397876,
        "duration": 214
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[1]/img)"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[1]/img)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at ActionSequence.mouseMove (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:151:44)\n    at ActionSequence.scheduleMouseAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:189:14)\n    at ActionSequence.mouseDown (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:225:17)\n    at sakshin.twitter (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:47:27)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:57:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\nFrom: Task: Run it(\"verify if the hand pointer clicks on twitter\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:56:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "000f009d-00ba-00dd-000f-009200290068.png",
        "timestamp": 1615010398398,
        "duration": 216
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[2]/img)"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[2]/img)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at ActionSequence.mouseMove (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:151:44)\n    at ActionSequence.scheduleMouseAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:189:14)\n    at ActionSequence.mouseDown (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:225:17)\n    at sakshin.facebook (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:52:27)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:62:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\nFrom: Task: Run it(\"verify if the hand pointer clicks on facebook\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:61:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "0065000f-00e2-00f0-00b1-009000030084.png",
        "timestamp": 1615010398958,
        "duration": 212
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[3]/img)"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_NAME_NOT_RESOLVED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[3]/img)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at ActionSequence.mouseMove (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:151:44)\n    at ActionSequence.scheduleMouseAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:189:14)\n    at ActionSequence.mouseDown (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:225:17)\n    at sakshin.linkdn (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:56:27)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:67:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\nFrom: Task: Run it(\"verify if the hand pointer clicks on linkedln\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:66:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "004c0081-00ee-0057-00da-004d000f00e4.png",
        "timestamp": 1615010399498,
        "duration": 222
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010848993,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849954,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849955,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849955,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849956,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849956,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849957,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849962,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849963,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849977,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849978,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010849993,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010850010,
                "type": ""
            }
        ],
        "screenShotFile": "000800c5-0011-00e0-003f-009b004900ee.png",
        "timestamp": 1615010845978,
        "duration": 4143
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010850994,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010850997,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010850997,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010851000,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010851000,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010851021,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010851022,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010851022,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010851052,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010851052,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010851052,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010851079,
                "type": ""
            }
        ],
        "screenShotFile": "006c001f-00a5-00b4-00d9-008600e600c8.png",
        "timestamp": 1615010850511,
        "duration": 586
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a0048-0007-0050-0095-008400e100cf.png",
        "timestamp": 1615010851485,
        "duration": 415
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006c00fb-0025-00b9-0089-00fc00bc0014.png",
        "timestamp": 1615010852289,
        "duration": 282
    },
    {
        "description": "verify if we login and by clicking on back button the username and password must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853503,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853503,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853546,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853547,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853547,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853547,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853550,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853550,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853556,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010853556,
                "type": ""
            }
        ],
        "screenShotFile": "00af00cd-0018-00cb-0039-00c4002b0056.png",
        "timestamp": 1615010852958,
        "duration": 814
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615010854455,
                "type": ""
            }
        ],
        "screenShotFile": "00760072-0074-0028-001a-00a1005a00ca.png",
        "timestamp": 1615010854162,
        "duration": 411
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c000cc-0042-00ff-00d3-002a00e90017.png",
        "timestamp": 1615010854879,
        "duration": 149
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008300d2-00bf-0099-00cf-0020007700c9.png",
        "timestamp": 1615010855360,
        "duration": 182
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e900e3-00e4-006c-00e8-00dc003800b9.png",
        "timestamp": 1615010855862,
        "duration": 177
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, input[id=\"username\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"username\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:12:19)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify with a valid login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:6:1)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ff0098-0049-0042-00d8-00ac00e600bd.png",
        "timestamp": 1615013753458,
        "duration": 32901
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(css selector, input[id=\"username\"])"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"username\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:20:18)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify if enter key works as a substitute for loginbtn\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:19:1)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "007d0022-0089-007c-007d-0046004a00b3.png",
        "timestamp": 1615013786785,
        "duration": 1800
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(css selector, input[id=\"password\"])"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"password\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:27:18)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify if username is not entered it should shown an toast message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:26:2)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00f90088-00d4-009f-002f-007f007200da.png",
        "timestamp": 1615013789045,
        "duration": 274
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(css selector, input[id=\"username\"])"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"username\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:32:19)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify if the password is not entered it should shown an toast message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:31:2)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00630065-0076-00dd-0075-00a000a1009a.png",
        "timestamp": 1615013789672,
        "duration": 298
    },
    {
        "description": "verify if we login and by clicking on back button the username and password must be retained|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(css selector, input[id=\"username\"])"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(css selector, input[id=\"username\"])\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:37:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify if we login and by clicking on back button the username and password must be retained\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:36:2)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00490018-00a2-0052-001b-00980063003a.png",
        "timestamp": 1615013790487,
        "duration": 273
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(xpath, /html/body/div/div/div[1]/a/img)"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/div[1]/a/img)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:51:18)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify if we click on logo 404 page loads\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:50:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00000066-0053-0052-00fd-009b005c007c.png",
        "timestamp": 1615013791176,
        "duration": 246
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[1]/img)"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[1]/img)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at ActionSequence.mouseMove (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:151:44)\n    at ActionSequence.scheduleMouseAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:189:14)\n    at ActionSequence.mouseDown (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:225:17)\n    at sakshin.twitter (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:50:27)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:57:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\nFrom: Task: Run it(\"verify if the hand pointer clicks on twitter\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:56:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "001f0005-00a4-008c-004f-002d00010075.png",
        "timestamp": 1615013791863,
        "duration": 283
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[2]/img)"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[2]/img)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at ActionSequence.mouseMove (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:151:44)\n    at ActionSequence.scheduleMouseAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:189:14)\n    at ActionSequence.mouseDown (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:225:17)\n    at sakshin.facebook (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:55:27)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:62:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\nFrom: Task: Run it(\"verify if the hand pointer clicks on facebook\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:61:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "001d008d-00e9-00ba-0094-001a003c00cd.png",
        "timestamp": 1615013792485,
        "duration": 135
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)",
            "Failed: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[3]/img)"
        ],
        "trace": [
            "WebDriverError: unknown error: net::ERR_INTERNET_DISCONNECTED\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.18363 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(https://sakshingp.github.io/assignment/login.html)\n    at Driver.schedule (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at ProtractorBrowser.get (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:653:32)\n    at sakshin.geturl (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:12:17)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:4:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:3:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)",
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/form/div[3]/div[2]/a[3]/img)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getId] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at ActionSequence.mouseMove (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:151:44)\n    at ActionSequence.scheduleMouseAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:189:14)\n    at ActionSequence.mouseDown (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\actions.js:225:17)\n    at sakshin.linkdn (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:59:27)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:67:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\nFrom: Task: Run it(\"verify if the hand pointer clicks on linkedln\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:66:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "006d0068-00a4-001b-0034-002a00d00063.png",
        "timestamp": 1615013793108,
        "duration": 295
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014096534,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014097302,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014097309,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014097388,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014097391,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014097393,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014097394,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014097398,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014097400,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014097604,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014098053,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014098055,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014098064,
                "type": ""
            }
        ],
        "screenShotFile": "001400ac-0033-009f-0016-006a00a8005f.png",
        "timestamp": 1615014092157,
        "duration": 6130
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102001,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102004,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102004,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102004,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102004,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102004,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102004,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102004,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102006,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102157,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102167,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014102167,
                "type": ""
            }
        ],
        "screenShotFile": "00e60081-0007-0022-0040-00be00c40046.png",
        "timestamp": 1615014098737,
        "duration": 3439
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00900074-00fd-0072-00e6-004a00c3007d.png",
        "timestamp": 1615014102536,
        "duration": 264
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00880075-001c-0046-0020-008000710048.png",
        "timestamp": 1615014103100,
        "duration": 331
    },
    {
        "description": "verify if we login and by clicking on back button the username and password must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104377,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104407,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104477,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104484,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104488,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014104501,
                "type": ""
            }
        ],
        "screenShotFile": "00c30053-00d6-004d-00f9-00f9006800ad.png",
        "timestamp": 1615014103776,
        "duration": 950
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014105683,
                "type": ""
            }
        ],
        "screenShotFile": "00c300dd-00de-009f-00e1-00e000140085.png",
        "timestamp": 1615014105068,
        "duration": 736
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003c00e2-00e8-009c-0063-00ad001c0059.png",
        "timestamp": 1615014106150,
        "duration": 154
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00df0036-00dd-0025-0038-007400ab005e.png",
        "timestamp": 1615014106761,
        "duration": 219
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00710057-00a5-003f-0073-0009003600d3.png",
        "timestamp": 1615014107320,
        "duration": 189
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html/body/div/div/h4)"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/h4)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at sakshin.loginform (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:19:52)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:13:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify with a valid login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:6:1)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014405922,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406406,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406406,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406428,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406431,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406431,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406431,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406446,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406446,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406446,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406446,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406446,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014406448,
                "type": ""
            }
        ],
        "screenShotFile": "00020072-005d-0083-001b-002200340062.png",
        "timestamp": 1615014403808,
        "duration": 2825
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407506,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407527,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407528,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407528,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407529,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407583,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407584,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407584,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014407586,
                "type": ""
            }
        ],
        "screenShotFile": "00410085-00e6-00c4-0051-001f005c0015.png",
        "timestamp": 1615014407096,
        "duration": 526
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003d00e9-006e-0048-00c5-002c005d0054.png",
        "timestamp": 1615014408043,
        "duration": 373
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c0092-009c-00df-00ea-007700870000.png",
        "timestamp": 1615014408800,
        "duration": 303
    },
    {
        "description": "verify if we login and by clicking on back button the username and password must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409918,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409961,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409962,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409963,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409963,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409964,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409964,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409966,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409967,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409967,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409967,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014409970,
                "type": ""
            }
        ],
        "screenShotFile": "001e00e8-0023-0050-0072-00380092009d.png",
        "timestamp": 1615014409410,
        "duration": 794
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014410972,
                "type": ""
            }
        ],
        "screenShotFile": "0054007f-00ea-00aa-0025-00dd006600ba.png",
        "timestamp": 1615014410636,
        "duration": 472
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0091007d-000b-00e7-0048-00e900dc00f0.png",
        "timestamp": 1615014411629,
        "duration": 165
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0022008d-002e-0073-00a5-008600340036.png",
        "timestamp": 1615014412136,
        "duration": 184
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5624,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a0001-00a4-00b6-00d5-0029004c007d.png",
        "timestamp": 1615014412644,
        "duration": 245
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13120,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, /html/body/div/div/h4)"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, /html/body/div/div/h4)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at sakshin.loginform (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:19:52)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:13:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify with a valid login\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:6:1)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014484835,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485598,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485600,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485611,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485612,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485614,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485615,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485616,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485617,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485619,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485621,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485625,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014485627,
                "type": ""
            }
        ],
        "screenShotFile": "00d9005f-00b8-00ee-0094-0003002700af.png",
        "timestamp": 1615014482894,
        "duration": 2924
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13120,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486649,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486658,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486659,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486661,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486673,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486674,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486675,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486677,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486678,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486682,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486682,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014486683,
                "type": ""
            }
        ],
        "screenShotFile": "00530019-0060-001c-0097-003c002b00cb.png",
        "timestamp": 1615014486254,
        "duration": 438
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13120,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00830003-0083-005c-001a-00750067000a.png",
        "timestamp": 1615014487074,
        "duration": 267
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13120,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00910091-00e4-009d-00f4-00870000008b.png",
        "timestamp": 1615014487671,
        "duration": 321
    },
    {
        "description": "verify if we login and by clicking on back button the username and password must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13120,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489063,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489119,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489121,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489122,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489122,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489123,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489123,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489123,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489124,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489124,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014489125,
                "type": ""
            }
        ],
        "screenShotFile": "0037009b-007e-0095-00f0-001000c3009e.png",
        "timestamp": 1615014488402,
        "duration": 1057
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13120,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615014490294,
                "type": ""
            }
        ],
        "screenShotFile": "001b0016-00a3-00d3-00a7-0039002f0069.png",
        "timestamp": 1615014489917,
        "duration": 535
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13120,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007d0061-00b6-006b-004e-00ea000c00ed.png",
        "timestamp": 1615014490858,
        "duration": 154
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13120,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ac0009-00cc-0039-0095-00ad00a20012.png",
        "timestamp": 1615014491354,
        "duration": 202
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13120,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00880031-00a4-00ee-0041-002600420000.png",
        "timestamp": 1615014491893,
        "duration": 265
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016141402,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142244,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142246,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142297,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142298,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142298,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142312,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142346,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142350,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016142423,
                "type": ""
            }
        ],
        "screenShotFile": "00600037-00f8-006b-00c1-00a7009f00ad.png",
        "timestamp": 1615016138354,
        "duration": 4233
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143451,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143496,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143505,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143510,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143645,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143645,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143645,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143645,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143708,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143713,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143807,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016143810,
                "type": ""
            }
        ],
        "screenShotFile": "00d200e1-0054-002f-0099-00c2008b0055.png",
        "timestamp": 1615016142979,
        "duration": 832
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007200fe-00be-00e6-0020-00a900b40099.png",
        "timestamp": 1615016144357,
        "duration": 299
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b5004d-00ee-0063-0078-00de009b00e8.png",
        "timestamp": 1615016145014,
        "duration": 303
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146351,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146383,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146459,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146459,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146459,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146462,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146462,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146463,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016146551,
                "type": ""
            }
        ],
        "screenShotFile": "00410051-003a-0067-00ed-00ce0031001c.png",
        "timestamp": 1615016145751,
        "duration": 1143
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615016147546,
                "type": ""
            }
        ],
        "screenShotFile": "00a20026-004a-005c-00d3-0081003600a1.png",
        "timestamp": 1615016147226,
        "duration": 415
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004c009a-0074-00b7-00be-007200b9000c.png",
        "timestamp": 1615016148063,
        "duration": 175
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d1004e-0025-0020-0070-00690053006e.png",
        "timestamp": 1615016148607,
        "duration": 182
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bc0039-00ec-00c2-0010-008a00c400fd.png",
        "timestamp": 1615016149114,
        "duration": 191
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: element(...).last is not a function"
        ],
        "trace": [
            "TypeError: element(...).last is not a function\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:67:72)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"should sort the table on click\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:66:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00080052-007f-0073-0098-008c00c400a4.png",
        "timestamp": 1615016149632,
        "duration": 152
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10060,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: missing ) after argument list"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:69\n        console.log(\"before sorting:\" + await mydata);\n                                        ^^^^^\n\nSyntaxError: missing ) after argument list\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "006800e4-00e1-00b9-004c-00e900c4006b.png",
        "timestamp": 1615017281069,
        "duration": 136
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6028,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: missing ) after argument list"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:69\n        console.log('before sorting:'+ await mydata);\n                                       ^^^^^\n\nSyntaxError: missing ) after argument list\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "008000e5-003e-0076-00e5-001200ca006e.png",
        "timestamp": 1615017547474,
        "duration": 130
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 2888,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: missing ) after argument list"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:69\n        console.log('before sorting:'+ await mydata);\n                                       ^^^^^\n\nSyntaxError: missing ) after argument list\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00980035-0072-00eb-0008-0029003f000d.png",
        "timestamp": 1615017583071,
        "duration": 158
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13052,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: missing ) after argument list"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:69\n        console.log('before sorting:'+ await mydata);\n                                       ^^^^^\n\nSyntaxError: missing ) after argument list\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "002f00db-00ea-001a-00c3-0096003100fa.png",
        "timestamp": 1615017599218,
        "duration": 136
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9184,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: missing ) after argument list"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:69\n        console.log('before sorting:'+ await mydata);\n                                       ^^^^^\n\nSyntaxError: missing ) after argument list\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "005400a8-005e-00c3-00aa-003600110007.png",
        "timestamp": 1615017616794,
        "duration": 138
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8648,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: missing ) after argument list"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:69\n        console.log('before sorting:'+ await mydata);\n                                       ^^^^^\n\nSyntaxError: missing ) after argument list\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "008a008b-0060-00ec-0026-00ba0060004c.png",
        "timestamp": 1615017813370,
        "duration": 179
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: Unexpected identifier"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:70\n        (await mydata).sort();\n               ^^^^^^\n\nSyntaxError: Unexpected identifier\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "004e00e4-00c7-0087-0006-00d700da002d.png",
        "timestamp": 1615017839892,
        "duration": 144
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017889815,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891143,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891172,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891193,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891212,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891230,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891246,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891269,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891269,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891315,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891696,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891750,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017891753,
                "type": ""
            }
        ],
        "screenShotFile": "00e40075-00ef-00a9-0092-000000e80005.png",
        "timestamp": 1615017886913,
        "duration": 5030
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893009,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893009,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893014,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893017,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893096,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893157,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893159,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893159,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893164,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893257,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893270,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017893273,
                "type": ""
            }
        ],
        "screenShotFile": "001d00a0-00ca-00ce-0038-009b001d00ad.png",
        "timestamp": 1615017892425,
        "duration": 859
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ab00b7-00d7-003f-0074-00a7009700b0.png",
        "timestamp": 1615017893695,
        "duration": 335
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f00dc-00ca-0039-000d-002f00f0006c.png",
        "timestamp": 1615017894378,
        "duration": 288
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895521,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895582,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895628,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895628,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895630,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895637,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895637,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895642,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895661,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895710,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895719,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017895721,
                "type": ""
            }
        ],
        "screenShotFile": "00b000cb-0054-0049-001a-00ae00f200a7.png",
        "timestamp": 1615017895005,
        "duration": 982
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017896892,
                "type": ""
            }
        ],
        "screenShotFile": "00a800ab-0051-00c1-0000-0051005200a6.png",
        "timestamp": 1615017896315,
        "duration": 679
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00df007a-00b9-0035-0090-00d400530059.png",
        "timestamp": 1615017897310,
        "duration": 143
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0082008d-00c6-00d3-0041-00f3004600fb.png",
        "timestamp": 1615017897781,
        "duration": 185
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006d0094-0037-0095-0073-00dd00b100ba.png",
        "timestamp": 1615017898340,
        "duration": 274
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 124,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: mydata.sort is not a function"
        ],
        "trace": [
            "TypeError: mydata.sort is not a function\n    at sakshin.sort (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:69:16)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:67:11)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"should sort the table on click\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:66:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a30027-0090-007c-00a4-001100df0047.png",
        "timestamp": 1615017898935,
        "duration": 163
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017920586,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921014,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921020,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921024,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921024,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921028,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921030,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921037,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921043,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921043,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921052,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921054,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921054,
                "type": ""
            }
        ],
        "screenShotFile": "00640052-002a-00c3-00b1-002700a700e8.png",
        "timestamp": 1615017918556,
        "duration": 2619
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921968,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921985,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921985,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921986,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921986,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921986,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017921986,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017922052,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017922053,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017922053,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017922053,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017922053,
                "type": ""
            }
        ],
        "screenShotFile": "006600e4-00c4-00dd-002a-008700fa00ac.png",
        "timestamp": 1615017921578,
        "duration": 502
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003100f3-0024-0046-0003-002d005f00e8.png",
        "timestamp": 1615017922410,
        "duration": 256
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003d00b6-00c3-00de-0097-00b50088006b.png",
        "timestamp": 1615017923012,
        "duration": 407
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924296,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924315,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924319,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924320,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924335,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924336,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924336,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924376,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924378,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924379,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924392,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017924393,
                "type": ""
            }
        ],
        "screenShotFile": "000a003c-0027-00b8-00cf-006700a4006b.png",
        "timestamp": 1615017923745,
        "duration": 849
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017925370,
                "type": ""
            }
        ],
        "screenShotFile": "001c001f-00a8-00ae-0085-009800a50034.png",
        "timestamp": 1615017924960,
        "duration": 529
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e100ca-0064-00fe-00a7-00b1007a0090.png",
        "timestamp": 1615017925869,
        "duration": 138
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b7001e-0080-0035-00a5-003900f10019.png",
        "timestamp": 1615017926367,
        "duration": 201
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007f0045-003c-00a2-0019-00fb003f0028.png",
        "timestamp": 1615017926930,
        "duration": 226
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4672,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d4002d-003d-00d5-00e5-0032002e0037.png",
        "timestamp": 1615017927580,
        "duration": 161
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017973399,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017973933,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017973934,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017973946,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017973981,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017973982,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017973999,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017973999,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017973999,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017974016,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017974034,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017974042,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017974048,
                "type": ""
            }
        ],
        "screenShotFile": "0074009a-009a-0078-0057-00e200970028.png",
        "timestamp": 1615017970668,
        "duration": 3472
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975073,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975149,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975149,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017975149,
                "type": ""
            }
        ],
        "screenShotFile": "00370032-004d-007c-00fb-0066007900da.png",
        "timestamp": 1615017974565,
        "duration": 679
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a90051-00ab-005b-001f-0012001c005d.png",
        "timestamp": 1615017975618,
        "duration": 326
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bc008c-0096-00fa-0010-00e500de007a.png",
        "timestamp": 1615017976334,
        "duration": 386
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977590,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977612,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977612,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977612,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977612,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977734,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977734,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977734,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977735,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977735,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977735,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017977811,
                "type": ""
            }
        ],
        "screenShotFile": "0066002a-0031-00bf-0093-009900410034.png",
        "timestamp": 1615017977066,
        "duration": 1074
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615017978733,
                "type": ""
            }
        ],
        "screenShotFile": "000300d4-00e1-000c-00da-0067000300bf.png",
        "timestamp": 1615017978467,
        "duration": 372
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007d0047-00ab-003f-0030-007a00390017.png",
        "timestamp": 1615017979214,
        "duration": 170
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007e0050-0090-00a5-00da-00a40006007f.png",
        "timestamp": 1615017979705,
        "duration": 173
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cb0070-0031-0087-00bd-00bd000200bf.png",
        "timestamp": 1615017980251,
        "duration": 294
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b400bf-00da-0047-004b-000000d10054.png",
        "timestamp": 1615017980850,
        "duration": 151
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045168,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045692,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045692,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045693,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045702,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045735,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045736,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045736,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045736,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045736,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045736,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045736,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018045736,
                "type": ""
            }
        ],
        "screenShotFile": "008c0022-00b7-002f-006f-005f00330004.png",
        "timestamp": 1615018015662,
        "duration": 30368
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018046900,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018046906,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018046943,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018046944,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018047009,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018047029,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018047093,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018047097,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018047104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018047104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018047105,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018047105,
                "type": ""
            }
        ],
        "screenShotFile": "00220093-00de-0016-0051-0024004c00e6.png",
        "timestamp": 1615018046483,
        "duration": 722
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00320002-0047-00e0-0018-00340045005c.png",
        "timestamp": 1615018047606,
        "duration": 335
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008300f5-008b-0043-0006-006b002800a8.png",
        "timestamp": 1615018048313,
        "duration": 366
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049654,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049675,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049689,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049761,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049762,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018049770,
                "type": ""
            }
        ],
        "screenShotFile": "00cf00fa-00aa-0053-009d-00a1004b0070.png",
        "timestamp": 1615018049122,
        "duration": 1269
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018051094,
                "type": ""
            }
        ],
        "screenShotFile": "004400dc-00e3-00c8-002d-004a0086003e.png",
        "timestamp": 1615018050723,
        "duration": 534
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a900ba-0067-0066-006c-0045002f0037.png",
        "timestamp": 1615018051646,
        "duration": 129
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00de004d-000f-0013-00db-0004000800f1.png",
        "timestamp": 1615018052113,
        "duration": 209
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0079002c-0025-00bb-00e6-00e000c40009.png",
        "timestamp": 1615018052643,
        "duration": 460
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000d00c2-0013-004d-005e-007b004800ec.png",
        "timestamp": 1615018053528,
        "duration": 236
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291117,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291655,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291655,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291657,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291772,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291773,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291804,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291805,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291805,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291805,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018291805,
                "type": ""
            }
        ],
        "screenShotFile": "002000fa-0088-00f0-00a2-00d600b900bb.png",
        "timestamp": 1615018289080,
        "duration": 2814
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292805,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292828,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292828,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292876,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292876,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292876,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292876,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292876,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292918,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292918,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292918,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018292918,
                "type": ""
            }
        ],
        "screenShotFile": "00c80005-0060-0063-005b-00b000fb0033.png",
        "timestamp": 1615018292357,
        "duration": 573
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a5000d-007b-0001-0010-008e00da0093.png",
        "timestamp": 1615018293323,
        "duration": 405
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e80096-00a0-007a-00f1-0080002100a3.png",
        "timestamp": 1615018294117,
        "duration": 300
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295326,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295360,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295360,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295360,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295361,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295361,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295361,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295394,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295395,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295395,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295395,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018295395,
                "type": ""
            }
        ],
        "screenShotFile": "00a60015-00d9-00f3-0048-001d009c0070.png",
        "timestamp": 1615018294773,
        "duration": 1025
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615018296426,
                "type": ""
            }
        ],
        "screenShotFile": "00190011-00ed-005d-0085-001200ae00a0.png",
        "timestamp": 1615018296142,
        "duration": 382
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004700c5-003a-0049-0021-009200d00018.png",
        "timestamp": 1615018296859,
        "duration": 155
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00430043-0036-0093-00c6-006a0053007b.png",
        "timestamp": 1615018297387,
        "duration": 255
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00be00a5-0002-00cf-00bc-009000de0009.png",
        "timestamp": 1615018298029,
        "duration": 221
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b200d5-0089-00a1-00d8-0039003d00d5.png",
        "timestamp": 1615018298625,
        "duration": 153
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090794781,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090795864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090795896,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090795949,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090795980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090796011,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090796039,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090796059,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090796075,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090796092,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090796100,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090796116,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090796126,
                "type": ""
            }
        ],
        "screenShotFile": "009f00aa-006d-0022-0048-000900ac004c.png",
        "timestamp": 1615090786797,
        "duration": 9476
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798108,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798108,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798108,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798108,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798123,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798132,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798161,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798161,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798161,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798173,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090798185,
                "type": ""
            }
        ],
        "screenShotFile": "00150038-00c3-0098-0069-0017006e0065.png",
        "timestamp": 1615090797455,
        "duration": 745
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c100d0-00ae-002b-006e-00ce00560070.png",
        "timestamp": 1615090798641,
        "duration": 317
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a9001b-00ef-0021-0018-008500a80006.png",
        "timestamp": 1615090799346,
        "duration": 354
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800708,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800712,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800728,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800729,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800729,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800730,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800756,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800756,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800756,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800790,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800790,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090800790,
                "type": ""
            }
        ],
        "screenShotFile": "00a900b4-0029-0036-00c1-00a3007f0046.png",
        "timestamp": 1615090800071,
        "duration": 963
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615090802114,
                "type": ""
            }
        ],
        "screenShotFile": "00010018-0086-0043-0086-001600c80058.png",
        "timestamp": 1615090801369,
        "duration": 838
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a200a1-0011-00b9-0086-007d005d0090.png",
        "timestamp": 1615090802594,
        "duration": 147
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b700d2-009a-0091-00a0-00d3001600e1.png",
        "timestamp": 1615090803079,
        "duration": 214
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00780038-0015-00c6-007a-005000d300c7.png",
        "timestamp": 1615090803619,
        "duration": 210
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10016,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0028001b-0028-000b-002f-00c400010038.png",
        "timestamp": 1615090804245,
        "duration": 161
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704583,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704584,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704599,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704606,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704622,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704622,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704623,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704623,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704659,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704664,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704685,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091704693,
                "type": ""
            }
        ],
        "screenShotFile": "007b00c9-00e9-0078-0051-003e003c00fa.png",
        "timestamp": 1615091702123,
        "duration": 2634
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705641,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705645,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705671,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705671,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705676,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705676,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705677,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705724,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705725,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705725,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705725,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091705725,
                "type": ""
            }
        ],
        "screenShotFile": "005e0006-00f3-008c-00b8-00bf005b00d5.png",
        "timestamp": 1615091705192,
        "duration": 558
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008d00d6-0002-00ee-00c8-00c800fa00c5.png",
        "timestamp": 1615091706114,
        "duration": 282
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c003b-0005-005f-007d-00eb0038007c.png",
        "timestamp": 1615091706761,
        "duration": 411
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708343,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708343,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708471,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708476,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708477,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708491,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708494,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708495,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708495,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708495,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091708495,
                "type": ""
            }
        ],
        "screenShotFile": "000900bb-0070-0071-003b-006900140009.png",
        "timestamp": 1615091707588,
        "duration": 1265
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091709677,
                "type": ""
            }
        ],
        "screenShotFile": "00b900e6-0030-0022-00c5-0019004d00f2.png",
        "timestamp": 1615091709270,
        "duration": 514
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00460049-0080-001b-0003-00b100ea003d.png",
        "timestamp": 1615091710201,
        "duration": 189
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001300c5-0025-0019-00f1-00bb00a40069.png",
        "timestamp": 1615091710760,
        "duration": 197
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000d0007-006b-0047-0099-00ee006f006e.png",
        "timestamp": 1615091711317,
        "duration": 186
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c800a5-00cc-005f-00db-0086001a0009.png",
        "timestamp": 1615091711846,
        "duration": 167
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798496,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798887,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798901,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798914,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798914,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798914,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798915,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798916,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798922,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091798958,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091799066,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091799067,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091799069,
                "type": ""
            }
        ],
        "screenShotFile": "003500d7-00b1-007f-00f9-00b700100017.png",
        "timestamp": 1615091796512,
        "duration": 2677
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800232,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800233,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800239,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800239,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800240,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800265,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800265,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800265,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800336,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800336,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800336,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091800336,
                "type": ""
            }
        ],
        "screenShotFile": "0054007a-0099-006f-0099-00880002007e.png",
        "timestamp": 1615091799712,
        "duration": 629
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000f00ed-008e-0002-000a-006e002400d5.png",
        "timestamp": 1615091800754,
        "duration": 427
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00620077-0081-00eb-00d9-009700ae0097.png",
        "timestamp": 1615091801516,
        "duration": 298
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802663,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802665,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802689,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802705,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802716,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802716,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091802716,
                "type": ""
            }
        ],
        "screenShotFile": "009e00d5-00da-009d-0088-0059006d0017.png",
        "timestamp": 1615091802161,
        "duration": 950
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091803730,
                "type": ""
            }
        ],
        "screenShotFile": "009f0025-00fb-0088-00d0-003200bc0083.png",
        "timestamp": 1615091803451,
        "duration": 383
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008a00dc-00dc-00d1-00db-00ca00420063.png",
        "timestamp": 1615091804190,
        "duration": 164
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a900c1-00f8-005b-000b-001b00bb003e.png",
        "timestamp": 1615091804752,
        "duration": 181
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0027005c-0067-00b4-004c-00a2009d00a3.png",
        "timestamp": 1615091805269,
        "duration": 266
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001d00e1-0062-00a3-00d1-00db0048004b.png",
        "timestamp": 1615091805917,
        "duration": 145
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091888922,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889710,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889712,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889712,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889713,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889713,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889718,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889738,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889739,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889772,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889773,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889774,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091889775,
                "type": ""
            }
        ],
        "screenShotFile": "00d70068-001c-0031-00c1-00060040009b.png",
        "timestamp": 1615091886885,
        "duration": 3426
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891515,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891525,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891550,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891552,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891554,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891554,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891554,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891554,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091891555,
                "type": ""
            }
        ],
        "screenShotFile": "00030032-00e5-00b0-0023-00ac001700b4.png",
        "timestamp": 1615091891103,
        "duration": 519
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e00ef-009d-0001-0060-00bf00e30096.png",
        "timestamp": 1615091892001,
        "duration": 301
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d00e5-00d1-0094-00a5-00a3002d00f7.png",
        "timestamp": 1615091892660,
        "duration": 268
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893800,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893813,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893813,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893861,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893861,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893862,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893862,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893863,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893863,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091893865,
                "type": ""
            }
        ],
        "screenShotFile": "007c00b5-000e-00b5-0094-008700dd001b.png",
        "timestamp": 1615091893303,
        "duration": 771
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091894729,
                "type": ""
            }
        ],
        "screenShotFile": "00b5003e-005c-006f-00f3-0020002c00bc.png",
        "timestamp": 1615091894463,
        "duration": 357
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00540078-0023-00db-0054-0079007a005f.png",
        "timestamp": 1615091895245,
        "duration": 177
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008d00f7-00f0-00a0-00a3-002400850076.png",
        "timestamp": 1615091895798,
        "duration": 167
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00920025-00ed-003a-00da-004b009c00bc.png",
        "timestamp": 1615091896341,
        "duration": 163
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bd003f-005d-00ba-0094-006e00a7007c.png",
        "timestamp": 1615091896998,
        "duration": 253
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091946508,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947000,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947001,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947007,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947008,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947008,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947009,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947011,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947012,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947019,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947046,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947056,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947057,
                "type": ""
            }
        ],
        "screenShotFile": "00d6000f-00c3-00ba-001b-00e000ba0067.png",
        "timestamp": 1615091944468,
        "duration": 2691
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947984,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091947991,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948007,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948049,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948049,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948050,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948054,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948058,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948066,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948071,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948084,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091948084,
                "type": ""
            }
        ],
        "screenShotFile": "0050006d-00fd-0029-00a3-001400d30009.png",
        "timestamp": 1615091947591,
        "duration": 526
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a8007f-00bc-000a-001f-0079003700a9.png",
        "timestamp": 1615091948526,
        "duration": 352
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0012006f-0085-00f9-0020-009600c000d5.png",
        "timestamp": 1615091949234,
        "duration": 338
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950410,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950417,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950421,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950433,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950441,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950443,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950443,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950443,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950443,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950444,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950449,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091950449,
                "type": ""
            }
        ],
        "screenShotFile": "00b5006c-00a0-00a5-00bb-001b007000a2.png",
        "timestamp": 1615091949926,
        "duration": 816
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091951392,
                "type": ""
            }
        ],
        "screenShotFile": "000c00d5-0030-005e-00cd-003d00610030.png",
        "timestamp": 1615091951109,
        "duration": 402
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00150005-0068-0049-0004-0093003a00e2.png",
        "timestamp": 1615091951882,
        "duration": 156
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00490095-00b5-00db-005a-0070000c0090.png",
        "timestamp": 1615091952379,
        "duration": 176
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00580060-0010-009a-00aa-00d900e40095.png",
        "timestamp": 1615091952895,
        "duration": 189
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9352,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: i is not defined"
        ],
        "trace": [
            "ReferenceError: i is not defined\n    at C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:68:26\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"should sort the table on click\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:66:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091953929,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091953941,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954011,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954012,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954013,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954013,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954014,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954014,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954014,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954015,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954016,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615091954016,
                "type": ""
            }
        ],
        "screenShotFile": "003e005b-0042-0014-00a8-006d006800ed.png",
        "timestamp": 1615091953427,
        "duration": 683
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092056602,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092056967,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092056978,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092056986,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092057087,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092057099,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092057101,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092057102,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092057103,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092057103,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092057103,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092057104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092057104,
                "type": ""
            }
        ],
        "screenShotFile": "00070041-0049-006c-00f1-00c3006300b9.png",
        "timestamp": 1615092054646,
        "duration": 2726
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058243,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058267,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058267,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058267,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058271,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058271,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058299,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058299,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058299,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058347,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058348,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092058349,
                "type": ""
            }
        ],
        "screenShotFile": "00e0002a-009a-008f-007f-00380089005a.png",
        "timestamp": 1615092057843,
        "duration": 773
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c0047-00b5-00b2-008c-0034008d00bc.png",
        "timestamp": 1615092059058,
        "duration": 286
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00270082-0065-001e-00b4-00db00e000e5.png",
        "timestamp": 1615092059685,
        "duration": 275
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060863,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060915,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060916,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060916,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060917,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060917,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060917,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092060919,
                "type": ""
            }
        ],
        "screenShotFile": "00cb00e6-00c9-0055-0035-001b000e009c.png",
        "timestamp": 1615092060300,
        "duration": 975
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092061919,
                "type": ""
            }
        ],
        "screenShotFile": "00d4006e-0001-0081-0078-009a004c0036.png",
        "timestamp": 1615092061630,
        "duration": 421
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d30071-00cc-003d-0062-00bb00a80083.png",
        "timestamp": 1615092062413,
        "duration": 138
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005000dc-00b0-0000-0046-002400e60035.png",
        "timestamp": 1615092062938,
        "duration": 205
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009a002d-00d6-003c-0097-0056000a00b5.png",
        "timestamp": 1615092063476,
        "duration": 187
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064495,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064531,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064532,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064532,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064533,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064562,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064563,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064564,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064564,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064565,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064565,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092064567,
                "type": ""
            }
        ],
        "screenShotFile": "009e001e-00b7-00d6-0029-0079000a000e.png",
        "timestamp": 1615092064004,
        "duration": 625
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7020,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: missing ) after argument list"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:70\n        console.log(\"before sorting:\" +await mydata);\n                                       ^^^^^\n\nSyntaxError: missing ) after argument list\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "008000cc-00be-00bc-00fe-00b100f70083.png",
        "timestamp": 1615092328006,
        "duration": 137
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7804,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: missing ) after argument list"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:70\n        console.log(\"before sorting:\" + await mydata);\n                                        ^^^^^\n\nSyntaxError: missing ) after argument list\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ea000c-0073-002e-0074-00750073007c.png",
        "timestamp": 1615092420598,
        "duration": 178
    },
    {
        "description": "encountered a declaration exception|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9464,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "SyntaxError: Unexpected identifier"
        ],
        "trace": [
            "C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:71\n        (await mydata).sort()\n               ^^^^^^\n\nSyntaxError: Unexpected identifier\n    at wrapSafe (internal/modules/cjs/loader.js:979:16)\n    at Module._compile (internal/modules/cjs/loader.js:1027:27)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)\n    at Module.require (internal/modules/cjs/loader.js:952:19)\n    at require (internal/modules/cjs/helpers.js:88:18)\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:2:13)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00570067-006f-006b-0008-002e001e005a.png",
        "timestamp": 1615092449622,
        "duration": 136
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092476615,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477201,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477211,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477213,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477215,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477217,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477218,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477220,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477224,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477225,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477226,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092477229,
                "type": ""
            }
        ],
        "screenShotFile": "000000de-00ac-0069-003d-00c900290076.png",
        "timestamp": 1615092474208,
        "duration": 3129
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478334,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478344,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478347,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478364,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478364,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478365,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478462,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478463,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092478463,
                "type": ""
            }
        ],
        "screenShotFile": "0091007e-0067-0043-009b-005a00d400e7.png",
        "timestamp": 1615092477831,
        "duration": 634
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002300df-0004-0008-0097-005b00f00093.png",
        "timestamp": 1615092478877,
        "duration": 306
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000300b0-0037-0026-0013-00cb000a00d0.png",
        "timestamp": 1615092479584,
        "duration": 272
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480979,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480982,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480985,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480985,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480986,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480994,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480994,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480994,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480995,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480995,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480995,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092480995,
                "type": ""
            }
        ],
        "screenShotFile": "00dd00ca-00a9-0037-004a-002d006400ea.png",
        "timestamp": 1615092480312,
        "duration": 1278
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092482268,
                "type": ""
            }
        ],
        "screenShotFile": "003a00a2-00c2-0000-00a0-001e005c0017.png",
        "timestamp": 1615092481938,
        "duration": 426
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e008f-00a8-007e-00af-000d006c00f6.png",
        "timestamp": 1615092482730,
        "duration": 147
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00db0030-00a1-00ea-0038-00d900db007f.png",
        "timestamp": 1615092483281,
        "duration": 185
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00660024-0085-00d5-000c-00b700430084.png",
        "timestamp": 1615092483834,
        "duration": 188
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8728,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: mydata.sort is not a function"
        ],
        "trace": [
            "TypeError: mydata.sort is not a function\n    at sakshin.sort (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:71:18)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:71:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"should sort the table on click\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:66:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00f40033-002e-0001-005b-00030014001e.png",
        "timestamp": 1615092484355,
        "duration": 168
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092573745,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574619,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574716,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574717,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092574718,
                "type": ""
            }
        ],
        "screenShotFile": "00ba0027-0073-00f9-007b-0032007b00d6.png",
        "timestamp": 1615092569779,
        "duration": 5005
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575617,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575647,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575651,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575652,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575670,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575671,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575799,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575800,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575800,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575800,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575801,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092575801,
                "type": ""
            }
        ],
        "screenShotFile": "008c00d1-00f7-0052-0018-0095005e007f.png",
        "timestamp": 1615092575169,
        "duration": 623
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004f0027-0082-000f-00df-00e1003a00e7.png",
        "timestamp": 1615092576163,
        "duration": 303
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ae0008-005b-0013-0000-005400cc00df.png",
        "timestamp": 1615092576844,
        "duration": 305
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092577991,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578002,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578077,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578267,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578268,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578268,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578269,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578270,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578270,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578271,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578271,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092578273,
                "type": ""
            }
        ],
        "screenShotFile": "00c1003f-0072-0044-00df-0099000d0010.png",
        "timestamp": 1615092577501,
        "duration": 975
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092579209,
                "type": ""
            }
        ],
        "screenShotFile": "00a60032-00c2-0092-0010-0066001a0021.png",
        "timestamp": 1615092578855,
        "duration": 452
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008d001e-0079-00ea-00cf-006200cc00a9.png",
        "timestamp": 1615092579646,
        "duration": 165
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ad0056-000d-0070-0076-00ce00c7003b.png",
        "timestamp": 1615092580149,
        "duration": 207
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e00fd-005e-0052-00d5-0034006c0000.png",
        "timestamp": 1615092580682,
        "duration": 240
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10940,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: mydata.sort is not a function"
        ],
        "trace": [
            "TypeError: mydata.sort is not a function\n    at sakshin.sort (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\po.js:71:18)\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:71:13)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"should sort the table on click\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:66:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00650013-0077-00f7-0005-00b200c7004a.png",
        "timestamp": 1615092581369,
        "duration": 149
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092620903,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621225,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621232,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621242,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621249,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621270,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621270,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621375,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621391,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621393,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621398,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621412,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092621413,
                "type": ""
            }
        ],
        "screenShotFile": "00ca00bf-008c-003f-0048-002f0092004d.png",
        "timestamp": 1615092618559,
        "duration": 2933
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622497,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622497,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622497,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622505,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622510,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622525,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622525,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622541,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622555,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622559,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622568,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092622580,
                "type": ""
            }
        ],
        "screenShotFile": "004500fa-00d1-00de-0023-00eb00ad00dd.png",
        "timestamp": 1615092622023,
        "duration": 561
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fb0028-0061-00c0-00d9-006e007900b6.png",
        "timestamp": 1615092622982,
        "duration": 319
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004900ec-0058-000e-0070-00ed00500049.png",
        "timestamp": 1615092623693,
        "duration": 292
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624810,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624821,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624823,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624837,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624846,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624856,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624857,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624879,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624879,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624904,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624905,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092624906,
                "type": ""
            }
        ],
        "screenShotFile": "002500bc-009a-00df-0085-00120050006e.png",
        "timestamp": 1615092624311,
        "duration": 818
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092625775,
                "type": ""
            }
        ],
        "screenShotFile": "000600a5-009d-0073-0082-00d300bb00d5.png",
        "timestamp": 1615092625482,
        "duration": 398
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004a0014-00de-0044-0005-0048001e0081.png",
        "timestamp": 1615092626244,
        "duration": 149
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003f00ac-00d5-0031-00cf-004d008f006a.png",
        "timestamp": 1615092626754,
        "duration": 182
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004500c2-0056-0092-0060-00ad00200059.png",
        "timestamp": 1615092627270,
        "duration": 173
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 252,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: mydata is not defined"
        ],
        "trace": [
            "ReferenceError: mydata is not defined\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:72:41)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"should sort the table on click\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:66:5)\n    at addSpecsToSuite (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\keerthana\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\keerthana\\Desktop\\wignify\\demo.js\\demo1.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ff00eb-0050-00e7-0007-00af008a001e.png",
        "timestamp": 1615092627811,
        "duration": 147
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679338,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679790,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679857,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679860,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679865,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679866,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679866,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679867,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679868,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092679936,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092680008,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092680023,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092680029,
                "type": ""
            }
        ],
        "screenShotFile": "004a006f-007b-00f3-00bc-001300be00a0.png",
        "timestamp": 1615092677152,
        "duration": 2943
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092680938,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681003,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681005,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681006,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681019,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681020,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681026,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681026,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681027,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681027,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681027,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092681145,
                "type": ""
            }
        ],
        "screenShotFile": "00ee0009-00aa-00e6-00c9-00e800d70058.png",
        "timestamp": 1615092680521,
        "duration": 645
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005c008c-0043-002d-00f7-00a7002d00e0.png",
        "timestamp": 1615092681560,
        "duration": 279
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001d00de-00bd-0001-0033-0097000d004f.png",
        "timestamp": 1615092682175,
        "duration": 290
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683315,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683330,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683330,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683330,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683367,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683369,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683369,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683369,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683369,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683369,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683396,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092683396,
                "type": ""
            }
        ],
        "screenShotFile": "008a002e-008f-009d-00fe-006100700083.png",
        "timestamp": 1615092682855,
        "duration": 818
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092684330,
                "type": ""
            }
        ],
        "screenShotFile": "004e00ee-0081-0053-00fa-009c00550043.png",
        "timestamp": 1615092684065,
        "duration": 367
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00660016-00b4-0005-0066-003b004f0000.png",
        "timestamp": 1615092684798,
        "duration": 153
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e0064-00b6-00c9-0009-000c00c9009a.png",
        "timestamp": 1615092685328,
        "duration": 206
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002300ba-0048-0054-0005-003100830090.png",
        "timestamp": 1615092685894,
        "duration": 173
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687194,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687253,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687253,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687253,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687253,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687326,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687327,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687351,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687351,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687351,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687352,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092687352,
                "type": ""
            }
        ],
        "screenShotFile": "00df0037-00b7-00d7-006d-001b0016001e.png",
        "timestamp": 1615092686407,
        "duration": 1117
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718048,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718472,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718473,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718492,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718536,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718538,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718544,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092718546,
                "type": ""
            }
        ],
        "screenShotFile": "003000e6-0018-006c-002f-00d200bd00bd.png",
        "timestamp": 1615092715895,
        "duration": 2748
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719529,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719561,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719563,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719563,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719568,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719576,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719577,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719577,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719577,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719578,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719617,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092719617,
                "type": ""
            }
        ],
        "screenShotFile": "007100e8-0079-00a5-00b9-009400370029.png",
        "timestamp": 1615092719042,
        "duration": 587
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004d0060-0046-0044-00d9-001a001900fc.png",
        "timestamp": 1615092720022,
        "duration": 344
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007a00bb-0061-00fa-00d2-006c00c40056.png",
        "timestamp": 1615092720732,
        "duration": 291
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092721999,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722056,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722057,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722058,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722058,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722059,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722059,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722060,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722062,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722095,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722095,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722095,
                "type": ""
            }
        ],
        "screenShotFile": "00f800e7-00a8-00e9-00f9-0019006a00aa.png",
        "timestamp": 1615092721395,
        "duration": 952
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092722998,
                "type": ""
            }
        ],
        "screenShotFile": "00af00f8-00de-0036-0025-000800aa009a.png",
        "timestamp": 1615092722697,
        "duration": 481
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00890029-0008-00f1-008c-001a0060008e.png",
        "timestamp": 1615092723550,
        "duration": 145
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008900cf-00b7-001d-00db-00de001a002f.png",
        "timestamp": 1615092724048,
        "duration": 302
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00db00bb-0044-00eb-0081-00b6005b00b0.png",
        "timestamp": 1615092724689,
        "duration": 200
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9420,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725729,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725763,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725765,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725772,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725773,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725832,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725834,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725834,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725840,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725841,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725841,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092725841,
                "type": ""
            }
        ],
        "screenShotFile": "00bc00e4-0049-00d8-00b0-00f8001c0050.png",
        "timestamp": 1615092725215,
        "duration": 755
    },
    {
        "description": "Verify with a valid login|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/favicon.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771015,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771475,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771476,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771476,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771480,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771491,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771497,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771511,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771519,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771527,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771527,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771527,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092771543,
                "type": ""
            }
        ],
        "screenShotFile": "000500b2-0030-00e5-006b-001800a400fb.png",
        "timestamp": 1615092769212,
        "duration": 2429
    },
    {
        "description": "Verify if enter key works as a substitute for loginbtn|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772441,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772463,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772463,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772463,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772463,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772502,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772502,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772517,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772540,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772550,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772550,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092772550,
                "type": ""
            }
        ],
        "screenShotFile": "00530087-0014-0079-0000-009d00b40070.png",
        "timestamp": 1615092772057,
        "duration": 511
    },
    {
        "description": "verify if username is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006f0086-0063-007a-001e-003800810093.png",
        "timestamp": 1615092772980,
        "duration": 270
    },
    {
        "description": "verify if the password is not entered it should shown an toast message|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0098004d-005f-00c0-00cc-00a800e1004f.png",
        "timestamp": 1615092773585,
        "duration": 261
    },
    {
        "description": "verify if we login and by clicking on back button the username must be retained|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774844,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774851,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774865,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774900,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774900,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774900,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774900,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774945,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774946,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774953,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774953,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092774987,
                "type": ""
            }
        ],
        "screenShotFile": "00540036-00c1-002a-0032-00f800fb003f.png",
        "timestamp": 1615092774273,
        "duration": 931
    },
    {
        "description": "verify if we click on logo 404 page loads|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/index.html - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092775833,
                "type": ""
            }
        ],
        "screenShotFile": "00880012-009f-0078-000d-00f000d700af.png",
        "timestamp": 1615092775567,
        "duration": 380
    },
    {
        "description": "verify if the hand pointer clicks on twitter|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fa001e-002f-0089-004d-002000e600b0.png",
        "timestamp": 1615092776339,
        "duration": 145
    },
    {
        "description": "verify if the hand pointer clicks on facebook|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00740076-00ae-00fe-0041-00eb0000007b.png",
        "timestamp": 1615092776832,
        "duration": 180
    },
    {
        "description": "verify if the hand pointer clicks on linkedln|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003500de-0093-006e-00f6-005500360067.png",
        "timestamp": 1615092777385,
        "duration": 164
    },
    {
        "description": "should sort the table on click|protractor demo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11988,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar1.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778411,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar2.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778425,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company2.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778425,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company1.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778444,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company4.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778452,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company7.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778506,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company6.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778506,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar3.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778509,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/avatar4.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778510,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778511,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/company3.png - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778557,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sakshingp.github.io/assignment/img/flashSale2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615092778559,
                "type": ""
            }
        ],
        "screenShotFile": "00f6001f-00fd-00d8-007e-0049008800ba.png",
        "timestamp": 1615092777889,
        "duration": 765
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
