import xgboost as xgb
import pandas as pd
import numpy as np

def model_predict(df : pd.DataFrame, features : list, model_name='xgb') -> list:
    probas = []
    if model_name == 'xgb':
        loaded_model = xgb.XGBClassifier()
        loaded_model.load_model("xgb_fullds.json")
        
        X = df[features].copy()
        probas = loaded_model.predict_proba(X)[:, 1]

    return list(probas)
    
