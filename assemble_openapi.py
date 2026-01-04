
import os
import json

def assemble_openapi_spec(output_file='docs/daikin-api/openapi.json', parts_dir='docs/daikin-api'):
    """
    Assembles the OpenAPI specification from its parts.
    """
    
    print(f"Assembling OpenAPI spec from {parts_dir} into {output_file}...")
    
    full_content = ""
    
    # Iterate through parts 1 to 24
    for i in range(1, 25):
        filename = f"openapi.part{i}.json"
        filepath = os.path.join(parts_dir, filename)
        
        if os.path.exists(filepath):
            print(f"Reading {filename}...")
            # Open with 'r' in text mode, UTF-8 encoding
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                full_content += content
        else:
            print(f"Warning: {filename} not found!")

    # Write the full content to the output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(full_content)
        print(f"Successfully assembled {output_file}")
        
        # Verify JSON validity
        print("Verifying JSON validity...")
        json.loads(full_content)
        print("JSON is valid.")
        print(f"Total length: {len(full_content)} characters")

    except json.JSONDecodeError as e:
        print(f"Error: assembled file is not valid JSON: {e}")
        print(f"Error context (around char {e.pos}):")
        start = max(0, e.pos - 500)
        end = min(len(full_content), e.pos + 500)
        print(full_content[start:end])
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    assemble_openapi_spec()
