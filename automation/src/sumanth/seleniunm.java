package sumanth;

import java.util.concurrent.TimeUnit;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.Select;
public class seleniunm 
{

public static void main(String[] args)
{
    System.setProperty("webdriver.chrome.driver", "c://drivers/chromedriver.exe");
     ChromeDriver driver=new ChromeDriver();
      driver.get("http://www.newtours.demoaut.com/");
      driver.manage().timeouts().implicitlyWait(30, TimeUnit.SECONDS);
      
      driver.findElement(By.linkText("REGISTER")).click();
      driver.findElement(By.name("firstName")).sendKeys("sumanth");
      driver.findElement(By.name("lastName")).sendKeys("a");
      driver.findElement(By.name("phone")).sendKeys("1234567896");
      driver.findElement(By.id("userName")).sendKeys("sumanth@gmail.com");
      driver.findElement(By.name("address1")).sendKeys("302,road:mahalaxmi"+Keys.TAB+"jntuh"+Keys.TAB+"HYD"+Keys.TAB+"TS"+Keys.TAB+"512346");
      Select s1=new Select(driver.findElement(By.name("country")));
      s1.selectByVisibleText("INDIA");
      driver.findElement(By.id("email")).sendKeys("sum123"+Keys.TAB+"s123"+Keys.TAB+"s123"+Keys.ENTER);
      driver.findElement(By.linkText("sign-in")).click();
      driver.findElement(By.name("userName")).sendKeys("sum123");
      driver.findElement(By.name("password")).sendKeys("s123");
      driver.findElement(By.name("button")).click();
      
}
}