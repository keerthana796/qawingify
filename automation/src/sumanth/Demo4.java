package sumanth;

public class Demo4 {
public static void main(String[] args)
{
	String s1="venkat is our hero";
	String s=" ";
	char ar[]=s1.toCharArray();
	for(int i=0;i<ar.length;i++)
	{
		if(ar[i]!=' ')
		{
			s=s+ar[i];
		}
	}
	System.out.println(s1);
}
}
