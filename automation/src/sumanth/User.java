package sumanth;

import java.util.List;

import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.interactions.Actions;
public class User {
public static void main(String[] args)
{
	System.setProperty("webdriver.chrome.driver","c://drivers/chromedriver.exe");
	    ChromeDriver cd=new ChromeDriver();
		cd.get("https://sakshingp.github.io/assignment/login.html");
		cd.findElement(By.id("username")).sendKeys("raju");
	   cd.findElement(By.id("password")).sendKeys("123456");
	   cd.findElement(By.id("log-in")).click();
	   WebElement w1=cd.findElement(By.id("amount"));
	   Actions a1=new Actions(cd);
	   a1.moveToElement(w1).click().build().perform();
	   cd.manage().window().maximize();
	   List<WebElement> amount=cd.findElement(By.xpath("//table[@id='transcationTable']/tbody/tr/td[1]"));
	   String[] beforeSort_amount = new string[amount.size()];
	   for(int i=0;i<amount.size();i++)
	   {
		  beforeSort_amount[i]= amount.get(i).getText().trim();
	   }
	   public static void main(String[] args)
	   {
		   
	   }
	   
}
}
