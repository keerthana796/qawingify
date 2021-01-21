package venkat;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

import org.apache.poi.EncryptedDocumentException;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.sl.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
public class Reading {
public static void main(String []args) throws IOException, EncryptedDocumentException, InvalidFormatException
{
	FileInputStream fis=new FileInputStream("c://testdata//userdata.xlsx");
	Workbook w1=WorkbookFactory.create(fis);
	org.apache.poi.ss.usermodel.Sheet s1= w1.getSheet("Sheet1");
	Row r1= s1.createRow(2);
	org.apache.poi.ss.usermodel.Cell c1= r1.createCell(2);
	c1.setCellValue("hero");
	FileOutputStream f2= new FileOutputStream("c://testdata//userdata.xlsx");
	w1.write(f2);
	System.out.println("successfull");

}
}