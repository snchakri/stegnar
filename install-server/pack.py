import tarfile
import zipfile
import os

def make_tar():
    with tarfile.open("agent.tar.gz", "w:gz") as tar:
        tar.add("endpoint-agent", arcname="endpoint-agent")
        tar.add("proto", arcname="proto")
    print("Created agent.tar.gz")

def make_zip():
    with zipfile.ZipFile("agent.zip", "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk("endpoint-agent"):
            for file in files:
                # Add file preserving relative directory structure
                zipf.write(os.path.join(root, file), os.path.join("endpoint-agent", os.path.relpath(os.path.join(root, file), "endpoint-agent")))
        for root, dirs, files in os.walk("proto"):
            for file in files:
                zipf.write(os.path.join(root, file), os.path.join("proto", os.path.relpath(os.path.join(root, file), "proto")))
    print("Created agent.zip")

if __name__ == "__main__":
    make_tar()
    make_zip()
