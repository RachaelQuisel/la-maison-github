import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import date
from decimal import Decimal

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'workflows/monthly-reporting'))
from fill_tot_form import compute_lines,build_field_values,fill_pdf,load_identity,validate_template,EXPECTED_FIELDS
from due_dates import deadline_for,deadlines_for,is_late
from pypdf import PdfReader

class Calculations(unittest.TestCase):
    def test_separate_bases(self):
        lines=compute_lines(line1=Decimal('1200'),line5=Decimal('1000'))
        self.assertEqual(lines['line4'],Decimal('144.00'))
        self.assertEqual(lines['line8'],Decimal('20.00'))
        self.assertEqual(lines['line9'],Decimal('164.00'))
    def test_deductions(self):
        lines=compute_lines(line1=Decimal('1200'),line5=Decimal('1000'),line2a=Decimal('200'),line6a=Decimal('100'))
        self.assertEqual(lines['line9'],Decimal('138.00'))
    def test_late_penalty(self):
        lines=compute_lines(line1=Decimal('1200'),line5=Decimal('1000'),late=True)
        self.assertEqual(lines['first_penalty'],Decimal('16.40'))
        self.assertEqual(lines['line12'],Decimal('180.40'))
    def test_invalid_amounts(self):
        for kwargs in [dict(line1=Decimal('-1'),line5=Decimal('0')),dict(line1=Decimal('100'),line5=Decimal('80'),line2a=Decimal('101')),dict(line1=Decimal('100'),line5=Decimal('80'),line6a=Decimal('81'))]:
            with self.assertRaises(ValueError):compute_lines(**kwargs)
    def test_month_method_deadlines(self):
        self.assertEqual(deadline_for(2026,10,'usps'),date(2026,11,14))
        self.assertEqual(deadline_for(2026,10,'city-hall'),date(2026,11,12))
        self.assertTrue(is_late(2026,10,date(2026,11,13),'city-hall'))
    def test_unsupported_period(self):
        with self.assertRaises(ValueError):deadlines_for(2027,12)
    def test_identity_must_be_complete(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'identity.json';p.write_text('{}')
            with self.assertRaises(ValueError):load_identity(p)
    def test_example_identity_and_field_mapping(self):
        load_identity(ROOT/'workflows/monthly-reporting/identity.example.json')
        lines=compute_lines(line1=Decimal('1200'),line5=Decimal('1000'))
        values=build_field_values(10,2026,None,date(2026,11,1),lines)
        self.assertEqual(values['TOT Account Number'],'EXAMPLE-ACCOUNT')
        self.assertEqual(values['GrandTotal2'],'164.00')
        self.assertNotIn('Signature',values)

class PdfContract(unittest.TestCase):
    def test_blank_official_template_contract(self):
        self.assertEqual(validate_template(),EXPECTED_FIELDS)
    def test_write_reopen_signature_and_overwrite(self):
        load_identity(ROOT/'workflows/monthly-reporting/identity.example.json')
        lines=compute_lines(line1=Decimal('1200'),line5=Decimal('1000'))
        values=build_field_values(10,2026,None,date(2026,11,1),lines)
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'example.pdf';fill_pdf(values,p)
            reader=PdfReader(p)
            fields=reader.get_fields()
            self.assertEqual(str(fields['GrandTotal2'].get('/V')),'164.00')
            self.assertFalse(fields['Signature'].get('/V'))
            self.assertIs(reader.trailer['/Root']['/AcroForm']['/NeedAppearances'].value,False)
            room_revenue=[]
            for page in reader.pages:
                for reference in page.get('/Annots',[]):
                    widget=reference.get_object()
                    parent=widget.get('/Parent')
                    name=widget.get('/T') or (parent.get_object().get('/T') if parent else None)
                    if name=='LineD':room_revenue.append(widget)
            self.assertEqual(len(room_revenue),1)
            stream=room_revenue[0]['/AP']['/N'].get_object()
            self.assertIn(b'(1,000.00)',stream.get_data())
            fonts=stream['/Resources']['/Font']
            self.assertTrue(any(font.get_object().get('/Encoding')=='/WinAnsiEncoding' for font in fonts.values()))
            with self.assertRaises(FileExistsError):fill_pdf(values,p)

if __name__=='__main__':unittest.main()
