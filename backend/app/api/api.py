from fastapi import FastAPI

app = FastAPI(
    title="TradeX API",
    version="1.0.0"
)

@app.get("/")
def root():
    return {
        "message":"TradeX Running Successfully"
    }