var HtmlReporter = require('protractor-beautiful-reporter');
// An example configuration file.
exports.config = {
  directConnect: true,

  // Capabilities to be passed to the webdriver instance.
  capabilities: {
    'browserName': 'chrome'
  },

  // Framework to use. Jasmine is recommended.
  framework: 'jasmine',

  // Spec patterns are relative to the current working directory when
  // protractor is called.
  specs: ['../demo.js/demo1.js'],
  
  



  // Options to be passed to Jasmine.
  jasmineNodeOpts: {
    defaultTimeoutInterval: 40000
  },


  //for reporting

  
   onPrepare: function() {
        // Add a screenshot reporter and store screenshots to `/tmp/screenshots`:
        jasmine.getEnv().addReporter(new HtmlReporter({
           baseDirectory: './report'
        }).getJasmine2Reporter());
        browser.waitForAngularEnabled(false);
        browser.manage().window().maximize();
   },
   
   
  
};