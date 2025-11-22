import requests
import sys

def verify_local(file_path):
    url = "http://localhost:8000/verify"
    files = {'file': open(file_path, 'rb')}
    data = {
        'challenge': 'test_challenge',
        'base_block': 100,
        'expires_block': 200
    }
    
    try:
        response = requests.post(url, files=files, data=data)
        print(response.json())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_local.py <path_to_video>")
        sys.exit(1)
    verify_local(sys.argv[1])
