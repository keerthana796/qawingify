package sumanth;

public class Demo7 {
public static void main(String[] args)
{
	int ar[]= {3,2,1,18,6};
	int ar1[]= {16,17,18,6,20};
	for(int i=0;i<ar.length;i++)
	{
		int count=0;
		for(int j=0;j<ar1.length;j++)
		{
			if(ar[i]==ar1[j])
			{
				count++;
				break;
			}
		}
		if(count!=0)
		{
			System.out.println(ar[i]);
		}
	}
}
}
