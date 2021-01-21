package sumanth;
import java.util.concurrent.TimeUnit;

import org.openqa.selenium.By;
import org.openqa.selenium.chrome.ChromeDriver;

public class surya 
{
public static void main(String[] args)
{
    System.setProperty("webdriver.chrome.driver", "c://drivers/chromedriver.exe");
    ChromeDriver driver=new ChromeDriver();
    driver.get("http://parabank.parasoft.com/parabank/index.htm");
    driver.manage().timeouts().implicitlyWait(30, TimeUnit.SECONDS);
    driver.findElement(By.linkText("Register")).click();
    driver.findElement(By.name("customer.firstName")).sendKeys("surya");
    driver.findElement(By.name("customer.lastName")).sendKeys("N");
    driver.findElement(By.name("customer.address.street")).sendKeys("suryasaketh.dt:302.kphb");
    driver.findElement(By.name("customer.address.city")).sendKeys("hyd");
    driver.findElement(By.name("customer.address.state")).sendKeys("ts");
    driver.findElement(By.name("customer.address.zipCode")).sendKeys("533101");
    driver.findElement(By.name("customer.phoneNumber")).sendKeys("9848012312");
    driver.findElement(By.name("customer.ssn")).sendKeys("123456");
    driver.findElement(By.name("customer.username")).sendKeys("suman");
    driver.findElement(By.name("customer.password")).sendKeys("s123");
    driver.findElement(By.name("repeatedPassword")).sendKeys("s123");
    driver.findElement(By.className("button")).click();
    driver.findElement(By.name("username")).sendKeys("suman");
    driver.findElement(By.name("password")).sendKeys("s123");
    driver.findElement(By.xpath("//input[@type='submit']")).click();

    












}
}
