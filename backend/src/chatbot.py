"""
Free Chatbot for FasalPramaan using Hugging Face Inference API
No API key required for this model
"""

import requests
import logging
from typing import Dict, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Chatbot:
    """Free chatbot using Hugging Face's free inference API"""
    
    # Using free, open-source models (no API key required)
    MODEL_URL = "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'FasalPramaan/1.0'
        })
        self.conversation_history = {}
    
    def get_response(self, query: str, plot_data: Optional[Dict] = None) -> Dict:
        """
        Get a response from the chatbot.
        If Hugging Face is unavailable, falls back to rule-based responses.
        """
        try:
            # Try Hugging Face API first
            response = self._query_huggingface(query, plot_data)
            if response:
                return response
        except Exception as e:
            logger.warning(f"Hugging Face API failed: {e}")
        
        # Fallback to rule-based responses
        return self._get_rule_based_response(query, plot_data)
    
    def _query_huggingface(self, query: str, plot_data: Optional[Dict] = None) -> Optional[Dict]:
        """Query Hugging Face inference API (free, no key)"""
        try:
            # Prepare context from plot data
            context = ""
            if plot_data:
                context = f"""
                Plot: {plot_data.get('plot_name', 'Unknown')}
                Crop: {plot_data.get('crop', 'Unknown')}
                NDVI Deviation: {plot_data.get('deviation_score', 'N/A')} σ
                Rainfall: {plot_data.get('rainfall_total', 'N/A')} mm
                Status: {plot_data.get('status', 'Unknown')}
                """
            
            # Full prompt with context
            prompt = f"{context}\n\nUser Question: {query}"
            
            # Hugging Face free inference (no API key)
            response = self.session.post(
                self.MODEL_URL,
                json={
                    "inputs": prompt,
                    "parameters": {
                        "max_length": 200,
                        "temperature": 0.7,
                        "do_sample": True
                    }
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data and isinstance(data, list) and len(data) > 0:
                    generated_text = data[0].get('generated_text', '')
                    # Extract only the response part (after the prompt)
                    if prompt in generated_text:
                        response_text = generated_text.replace(prompt, '').strip()
                    else:
                        response_text = generated_text[:300]
                    
                    return {
                        "response": response_text or self._get_fallback_response(query),
                        "source": "Hugging Face AI"
                    }
            else:
                logger.warning(f"Hugging Face API returned {response.status_code}")
                
        except requests.exceptions.Timeout:
            logger.warning("Hugging Face API timed out")
        except Exception as e:
            logger.warning(f"Hugging Face API error: {e}")
        
        return None
    
    def _get_rule_based_response(self, query: str, plot_data: Optional[Dict] = None) -> Dict:
        """Fallback rule-based responses (no API needed)"""
        query_lower = query.lower()
        response = ""
        
        # Plot-specific responses
        if plot_data:
            deviation = plot_data.get('deviation_score', 0)
            status = plot_data.get('status', 'unknown')
            crop = plot_data.get('crop', 'crop')
            rainfall = plot_data.get('rainfall_total', 0)
            
            if 'deviation' in query_lower or 'ndvi' in query_lower or 'score' in query_lower:
                if deviation < -2:
                    response = f"The NDVI deviation score of {deviation:.2f} σ indicates severe vegetation stress. This is significantly below the historical baseline, suggesting crop damage."
                elif deviation < -1.5:
                    response = f"The NDVI deviation score of {deviation:.2f} σ indicates moderate vegetation stress. There is a noticeable decline from the historical baseline."
                elif deviation < -0.5:
                    response = f"The NDVI deviation score of {deviation:.2f} σ indicates slight vegetation stress. The crop is somewhat below normal health."
                else:
                    response = f"The NDVI deviation score of {deviation:.2f} σ indicates normal vegetation health. The crop is within the expected range."
            
            elif 'stress' in query_lower or 'healthy' in query_lower:
                if status == 'anomaly_detected':
                    response = f"Your {crop} crop is showing signs of stress. The vegetation health is {abs(deviation):.1f} standard deviations below normal. You may want to file an appeal if this matches your field observations."
                else:
                    response = f"Your {crop} crop appears healthy. The vegetation health is within the normal range. No significant stress detected."
            
            elif 'rainfall' in query_lower or 'rain' in query_lower or 'weather' in query_lower:
                response = f"Total rainfall during the damage period was {rainfall:.1f} mm. This is {'above' if rainfall > 200 else 'below'} normal for the region."
            
            elif 'appeal' in query_lower or 'claim' in query_lower:
                if status == 'anomaly_detected':
                    response = "Based on the satellite analysis showing significant vegetation stress, you have evidence to support an insurance claim appeal. Download the appeal document from the results panel and file it with the District Grievance Redressal Committee."
                else:
                    response = "The analysis shows normal vegetation health, which may not support a claim appeal. However, you should still document your field observations and consult with a local agricultural officer."
            
            elif 'crop' in query_lower or 'what' in query_lower:
                response = f"Your plot is growing {crop}. The analysis covers the Kharif 2017 season. {crop.capitalize()} typically has a healthy NDVI baseline around 0.55 for cotton, 0.50 for bajra, and 0.65 for paddy."
            
            else:
                response = self._get_fallback_response(query)
        
        else:
            # General responses without plot data
            if 'ndvi' in query_lower:
                response = "NDVI (Normalized Difference Vegetation Index) measures plant health from satellite imagery. Values range from 0 to 1, with higher values indicating healthier vegetation."
            elif 'appeal' in query_lower:
                response = "You can file an appeal by downloading the appeal document from the analysis results panel. It contains all the evidence needed to support your claim."
            elif 'fasal' in query_lower or 'pramaan' in query_lower:
                response = "FasalPramaan is an independent crop insurance verification tool. We use satellite and weather data to help farmers verify insurance assessments."
            else:
                response = self._get_fallback_response(query)
        
        return {
            "response": response or "I'm here to help you understand your crop analysis. Feel free to ask about NDVI, rainfall, stress, or how to file an appeal.",
            "source": "Rule-based (Free)"
        }
    
    def _get_fallback_response(self, query: str) -> str:
        """Generic fallback responses"""
        fallbacks = [
            "I'm an AI assistant for FasalPramaan. I can help you understand NDVI scores, rainfall data, crop stress, and how to file an appeal. What would you like to know?",
            "That's a great question! I can explain the satellite analysis, weather data, or help you understand the deviation score. What specific aspect are you curious about?",
            "I'm here to help! Ask me about your crop's NDVI score, the rainfall comparison, or how to appeal an insurance assessment.",
            "I can help you interpret the satellite data and understand what it means for your crop insurance claim. What would you like to know?"
        ]
        import random
        return random.choice(fallbacks)