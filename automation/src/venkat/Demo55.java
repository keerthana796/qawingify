package venkat;

import java.util.Scanner;

public class Demo55
{
public static void main(String[] args)
{
Scanner sc=new Scanner(System.in);
System.out.println("enter a number");
int input=sc.nextInt();
boolean prime;
for(int i=2;i<input;i++)
{
	if(input%2==0)
	{
		prime=true;
	}
		else
		{
			prime=false;	
	}
	if(prime==true)
	{
		System.out.println("is a prime");
	}
	else
	{
		System.out.println("not a prime");
	}
}
}
}
