package sumanth;
import java.util.concurrent.TimeUnit;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.chrome.ChromeDriver;

public class sutr 
{
public static void main(String []args)
{
    System.setProperty("webdriver.chrome.driver", "c://drivers/chromedriver.exe");
    ChromeDriver driver=new ChromeDriver();
    driver.get("http://parabank.parasoft.com/parabank/index.htm");
    driver.manage().timeouts().implicitlyWait(30, TimeUnit.SECONDS);
	driver.findElement(By.name("username")).sendKeys("suman"+Keys.TAB+"s123"+Keys.ENTER);
}
}