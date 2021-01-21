package venkat;

import org.openqa.selenium.chrome.ChromeDriver;

public class Demo444 
{
public static void main(String[] args)
{
	System.setProperty("webdriver.chrome.driver","c://drivers/chromedriver.exe");
	ChromeDriver driver=new ChromeDriver();
	driver.get("http://desktop-vq4duqg:81/login.do");
	String s1=driver.getPageSource();
	System.out.println(s1);
}
}