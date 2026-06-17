from pydantic import BaseModel


class WatchlistCreate(BaseModel):
    stock_id: int 


class WatchlistDelete(BaseModel):
    stock_id: int