package sumanth;

import java.awt.AWTException;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

import org.apache.commons.io.FileUtils;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.events.EventFiringWebDriver;

public class screen 
{

	public static void main(String[] args) throws InterruptedException,AWTException, IOException
	{	
		System.setProperty("webdriver.chrome.driver", "c://drivers/chromedriver.exe");
	     ChromeDriver driver=new ChromeDriver();
	      driver.get("http://127.0.0.1:81/login.do");
	      driver.manage().timeouts().implicitlyWait(30, TimeUnit.SECONDS);
	      driver.manage().window().maximize();
	      EventFiringWebDriver d=new EventFiringWebDriver(driver);
	      
	     File f1=d.getScreenshotAs(OutputType.FILE);
	      File f2=new File("C://Screenshots//login1.jpg");
	      FileUtils.moveFile(f1, f2);																												
	    
	      
	}
}