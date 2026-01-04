
import os
import glob

parts = ["p1.txt", "p2.txt", "p3.txt", "p4.txt", "p5.txt"]
full_content = ""

print("Reading fragments...")
for p in parts:
    path = os.path.join(os.getcwd(), "docs/daikin-api", p)
    if os.path.exists(path):
        with open(path, "r") as f:
            content = f.read()
            print(f"{p}: length {len(content)}")
            
            # Trim the leading 't' in p1.txt if it exists and looks suspicious
            if p == "p1.txt" and content.startswith("t\t"):
                print("Removing leading 't' from p1.txt")
                content = content[1:]
                
            full_content += content
    else:
        print(f"{p}: MISSING")

print(f"Total length before decoding: {len(full_content)}")

# No unescape for this batch
decoded = full_content

output_path = os.path.join(os.getcwd(), "docs/daikin-api/openapi.part11.json")
with open(output_path, "w") as f:
    f.write(decoded)

print(f"Written to {output_path} (No unscape)")

# Cleanup
for p in parts:
    if os.path.exists(os.path.join(os.getcwd(), "docs/daikin-api", p)):
        os.remove(os.path.join(os.getcwd(), "docs/daikin-api", p))
