package sumanth;

public class largest {
public static void main(String[] args)
{
	int ar[]= {12,10,500,-60,25,55};
	int Max=ar.length;
	for(int i=0;i<ar.length-1;i++)
	{
	if(ar[i]>ar.length)
	{
		Max=ar[i];
	}
	}
	System.out.println("minimum="+Max);
}
}