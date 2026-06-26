#!/usr/bin/env python3

import re


def extract_version_from_bug_report():
    with open(".github/ISSUE_TEMPLATE/bug-report.yml", "r") as file:
        for line in file:
            match = re.match(r"^\s*-\s*(\d+\.\d+\.\d+)", line)
            if match:
                return match.group(1)
    return None


def extract_version_from_config():
    with open("docs/.vitepress/config.js", "r") as file:
        content = file.read()
    match = re.search(r"appVersion: \'(\d+\.\d+\.\d+)\'", content)
    if match:
        return match.group(1)
    return None


def main():
    bug_report_version = extract_version_from_bug_report()
    config_version = extract_version_from_config()

    if (
        bug_report_version != config_version
    ):
        print("Version mismatch detected:")
        print(f"  Bug report version: {bug_report_version}")
        print(f"  Config.js version: {config_version}")
        exit(1)

    print("Version check passed. All versions are consistent.")


if __name__ == "__main__":
    main()
