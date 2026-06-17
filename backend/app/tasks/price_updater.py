import time
import requests

while True:

    try:

        response = requests.post(
            "http://127.0.0.1:8000/stocks/update-prices"
        )

        print(
            "Updated:",
            response.status_code
        )

    except Exception as e:

        print(
            "Error:",
            e
        )

    time.sleep(0.5)