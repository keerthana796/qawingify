describe('protractor demo', () => {
    var obj=require("./po.js")
    beforeEach(function() {
    obj.geturl();
});
it('Verify with a valid login', function() {
    
     obj.username.sendKeys('admin');
     obj.password.sendKeys('admin1234');
     obj.rememberme.click();
     obj.loginbtn.click();
     obj.amount.click();
    
});
it('Verify if enter key works as a substitute for loginbtn', function() {
    obj.username.sendKeys('admin')
    obj.password.sendKeys('admin1234')
    obj.rememberme.click();
    browser.actions().sendKeys(protractor.Key.ENTER).perform();
        
});
 it('verify if username is not entered it should shown an toast message', function() {
    obj.password.sendKeys('admin1234');
    obj.loginbtn.click();
    obj.getnamealrt();
 });
 it('verify if the password is not entered it should shown an toast message', function() {
     obj.username.sendKeys('admin');
     obj.loginbtn.click();
     obj.getpassalrt();
    });
 it('verify if we login and by clicking on back button the username must be retained', function() {
      obj.username.sendKeys('admin');
      obj.password.sendKeys('admin1234');
      obj.rememberme.click();
      obj.loginbtn.click();
      obj.amount.click();
   
      browser.navigate().back();
      obj.loginbtn.click();
      obj.getbackbrowser();

                 
    });
    
    it('verify if we click on logo 404 page loads', function() {
        obj.logo.click();
        obj.fileNotfount();
        
    });
    
    it('verify if the hand pointer clicks on twitter', function() {
        obj.twitter();
        
    });
    
    it('verify if the hand pointer clicks on facebook', function() {
        obj.facebook();
        
    });
    
    it('verify if the hand pointer clicks on linkedln', function() {
        obj.linkdn();
        
    });
    it("should sort the table on click", function() {
        obj.username.sendKeys('admin');
        obj.password.sendKeys('admin1234');
        obj.rememberme.click();
        obj.loginbtn.click();
        obj.amount.click();
        obj.sort();
        
        
    });


afterEach(function() {
    console.log('test is completed')
  });

});


