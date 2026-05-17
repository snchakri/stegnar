import os
import re

def fix_py2_to_py3(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                
                new_lines = []
                changed = False
                for line in lines:
                    # 1. Fix print statements: print "foo" -> print("foo")
                    # regex: start of line (optionally space) + 'print' + space + (not open paren)
                    match = re.match(r'^(\s*)print\s+([^\(].*)$', line)
                    if match:
                        indent = match.group(1)
                        content = match.group(2).strip()
                        # handle comments
                        comment = ""
                        if "#" in content:
                            parts = content.split("#", 1)
                            content = parts[0].strip()
                            comment = " #" + parts[1]
                        
                        new_line = "{indent}print({content}){comment}\n".format(
                            indent=indent, content=content, comment=comment
                        )
                        new_lines.append(new_line)
                        changed = True
                    else:
                        # 2. Fix izip -> zip
                        if "izip" in line:
                            line = line.replace("itertools.izip", "zip")
                            line = line.replace("from itertools import izip", "pass # izip removed")
                            changed = True
                        new_lines.append(line)
                
                if changed:
                    with open(path, "w", encoding="utf-8") as f:
                        f.writelines(new_lines)
                    print("Fixed: {}".format(path))

if __name__ == "__main__":
    fix_py2_to_py3("CALPA-NET-master")
