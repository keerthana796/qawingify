package sumanth;
import java.util.concurrent.TimeUnit;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;

public class para 
{
public static void main(String []args)
{
    System.setProperty("webdriver.chrome.driver", "c://drivers/chromedriver.exe");
    ChromeDriver driver=new ChromeDriver();
    driver.get("http://127.0.0.1:81/login.do");
    driver.manage().timeouts().implicitlyWait(10, TimeUnit.SECONDS);
    driver.findElement(By.name("username")).sendKeys("admin");
    driver.findElement(By.name("pwd")).sendKeys("manager");
    driver.findElement(By.xpath("//input[@type='submit']")).click();
    driver.findElement(By.linkText("Projects & Customers")).click();
    driver.findElement(By.xpath("//input[@value='Add New Customer']")).click();
    driver.findElement(By.name("name")).sendKeys("venkat");
    driver.findElement(By.name("description")).sendKeys("selenium project");
    driver.findElement(By.name("createCustomerSubmit")).click();
    String s = driver.findElement(By.xpath("//span[@type='successmsg']")).getText();
    System.out.println(s);
    
}
}