windows

python -m venv venv
.\venv\Scripts\activate

.\cli_venv\Scripts\activate


mac

python3 -m venv ssh_venv
source ssh_venv/bin/activate
deactivate


pip install -r requirements.txt

uvicorn main:app --reload

deactivate