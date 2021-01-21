package sumanth;

public class Demo3 {
public static void main(String[] args)
{
	int ar[]= {5,4,6,5,7,8,7};
	for(int i=0;i<ar.length;i++)
	{
		for(int j=i+1;j<ar.length-1;j++)
		{
			if(ar[i]==ar[j])
			{
				System.out.println("duplicates are there");
				System.out.println(ar[i]);
			}
		}
	}
}
}
