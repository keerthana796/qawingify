function sakshin()
{
    this.username=element(by.css('input[id="username"]'));
    this.password=element(by.css('input[id="password"]'));
    this.rememberme=element(by.css('input[type="checkbox"]'));
    this.loginbtn=element(by.buttonText("Log In"));
    this.amount=element(by.css('th[class="text-right"]'));
    this.logo=element(by.xpath('/html/body/div/div/div[1]/a/img'));

    this.geturl=function()
    {
        browser.get('https://sakshingp.github.io/assignment/login.html');
        browser.getCurrentUrl().then((url) => {
            expect(url).toBe('https://sakshingp.github.io/assignment/login.html');
            });
       
    }
    this.getnamealrt=function()
    {
        element(by.css('[class="alert alert-warning"]')).getText().then(function(text)
        {
            console.log(text);
            expect(text).toMatch("Username must be present");
         
        })  
    }
    this.getpassalrt=function()
    {
        element(by.css('[class="alert alert-warning"]')).getText().then(function(text){
            console.log(text);
            expect(text).toMatch("Password must be present");

        });
       
    }
    this.getbackbrowser=function(){
        element(by.css('[class="alert alert-warning"]')).getText().then(function(text) {
            console.log(text);
            expect(text).toMatch("Password must be present");
         });
    }
    this.fileNotfount=function(){
        element(by.xpath('/html/body/div/p[1]')).getText().then(function(text){
            console.log(text)
            expect(text).toContain('File not found');

        });
    }
    this.twitter=function(){
        browser.actions().mouseDown(element(by.xpath('/html/body/div/div/form/div[3]/div[2]/a[1]/img'))).perform();
        console.log("twitter icon is clickable");

    }
    this.facebook=function(){
        browser.actions().mouseDown(element(by.xpath('/html/body/div/div/form/div[3]/div[2]/a[2]/img'))).perform();
        console.log("facebook icon is clickable")
    }
    this.linkdn=function(){
        browser.actions().mouseDown(element(by.xpath('/html/body/div/div/form/div[3]/div[2]/a[3]/img'))).perform();
        console.log('linkedln icon is clickable')
    }
    this.sort=function(){
        let table= $$('tabel');
        let rows = table.$$("tr");
        let mydata=rows.map(async(ele,index) => {
            let data = ele.$$('td').get(4)
            return data.getText()
            mydata.sort()
            
            
        });
        
    
    }
        
    
}
module.exports = new sakshin();