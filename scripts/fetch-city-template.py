"""Fetch the public blank form; reject a changed contract before saving."""
from pathlib import Path
import hashlib
from urllib.request import urlopen
from io import BytesIO
from pypdf import PdfReader

URL='https://santabarbaraca.gov/sites/default/files/2026-08/TOT%20%26%20TBID%20Remittance%20Form%20-%20Accessible%20Fillable.pdf'
EXPECTED_SHA256='b9543fd47a24e440f570773fe96159990d8c140dff7b6bbfed8b9afafbf008b8'
with urlopen(URL,timeout=30) as response:data=response.read()
if hashlib.sha256(data).hexdigest()!=EXPECTED_SHA256:raise ValueError('The City form changed. Review its fields and mapping before use.')
fields=PdfReader(BytesIO(data)).get_fields() or {}
calculated={'Total1','Total2','Total3','Total4','GrandTotal1','GrandTotal2'}
if len(fields)!=25 or any(field.get('/V') not in (None,'','0',0) if key in calculated else field.get('/V') not in (None,'') for key,field in fields.items()):raise ValueError('Expected the reviewed blank-identity 25-field City form.')
target=Path(__file__).resolve().parents[1]/'workflows/monthly-reporting/templates/TOT+TBID Remittance Form effective 2026-08-01.pdf'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_bytes(data)
print('Downloaded the public blank City form; checksum, empty fields, and field count verified.')
