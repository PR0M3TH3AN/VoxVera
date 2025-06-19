#!/bin/bash

# Define the input PDF, output text file, and output JSON
pdf_file="./from_client/submission_form.pdf"
text_file="submission_form.txt"
json_file="config.json"

# Log the start of the script
echo "Starting script..."
echo "Looking for PDF at: $pdf_file"
echo "Config JSON: $json_file"

# Convert PDF to text
echo "Converting PDF to text..."
pdftotext -layout "$pdf_file" "$text_file"

# Extract individual fields using grep, logging each step
echo "Extracting fields from the text file..."

# Adjusting the extraction of the name field
name=$(grep -A 3 'name (max 25 characters):' "$text_file" | tail -n 1 | awk '{$1=$1;print}')
echo "Extracted name: '$name'"

subdomain=$(grep -A 1 'subdomain (max 30 characters):' "$text_file" | tail -n 1 | awk '{$1=$1;print}')
echo "Extracted subdomain: '$subdomain'"

title=$(grep -A 1 'title (max 30 characters):' "$text_file" | tail -n 1 | awk '{$1=$1;print}')
echo "Extracted title: '$title'"

subtitle=$(grep -A 1 'subtitle (max 45 characters):' "$text_file" | tail -n 1 | awk '{$1=$1;print}')
echo "Extracted subtitle: '$subtitle'"

headline=$(grep -A 1 'headline (max 50 characters):' "$text_file" | tail -n 1 | awk '{$1=$1;print}')
echo "Extracted headline: '$headline'"

# Process the content to remove soft wraps while keeping hard returns
content=$(grep -A 100 'content (max 1,400 characters):' "$text_file" | sed -n '2,/url_message/p' | sed '$d' | awk '
{
    if (NR == 1) {
        prev = $0;
        next;
    }

    # Handle paragraph breaks explicitly
    if ($0 ~ /^[[:space:]]*$/) {
        if (prev) print prev "\n";
        prev = "";
    }
    # Handle sentences that should stay together
    else if (prev ~ /[.?!]$/ && $0 ~ /^[[:upper:]]/) {
        prev = prev " " $0;
    }
    # Join lines that are part of the same sentence (soft wrap)
    else if (prev !~ /[.?!]$/) {
        prev = prev " " $0;
    }
    # Otherwise, treat as a new sentence/paragraph
    else {
        if (prev) print prev;
        prev = $0;
    }
}
END { if (prev) print prev }' | sed -E 's/\n\n[[:space:]]+/\n\n/g' | sed -E 's/^[[:space:]]+//g')

echo "Extracted content: '$content'"

url_message=$(grep -A 1 'url_message (max 60 characters):' "$text_file" | tail -n 1 | awk '{$1=$1;print}')
echo "Extracted url_message: '$url_message'"

url=$(grep -A 1 'url (max 90 characters):' "$text_file" | tail -n 1 | awk '{$1=$1;print}')
echo "Extracted url: '$url'"

# Construct the URLs with the subdomain
onion_base="6dshf2gnj7yzxlfcaczlyi57up4mvbtd5orinuj5bjsfycnhz2w456yd.onion"
constructed_url="http://$subdomain.$onion_base"

# Use an existing tear_off_link from the config if provided; otherwise default
# to the constructed onion URL.
existing_tear_off_link=$(jq -r '.tear_off_link // empty' "$json_file")
tear_off_link="${existing_tear_off_link:-http://$subdomain.$onion_base}"

echo "Constructed URL: '$constructed_url'"
echo "Using Tear-off Link: '$tear_off_link'"

# Check if the extracted fields are not empty
if [ -z "$name" ] || [ -z "$subdomain" ] || [ -z "$title" ] || [ -z "$subtitle" ] || [ -z "$headline" ] || [ -z "$content" ] || [ -z "$url_message" ] || [ -z "$url" ]; then
    echo "Error: One or more extracted fields are empty. Please check the PDF form and try again."
    exit 1
fi

# Update the JSON using jq and log the operation
echo "Updating config.json..."
jq --arg name "$name" \
   --arg subdomain "$subdomain" \
   --arg title "$title" \
   --arg subtitle "$subtitle" \
   --arg headline "$headline" \
   --arg content "$content" \
   --arg url_message "$url_message" \
   --arg url "$url" \
   --arg tear_off_link "$tear_off_link" \
   '.name = $name | 
    .subdomain = $subdomain | 
    .title = $title | 
    .subtitle = $subtitle | 
    .headline = $headline | 
    .content = $content | 
    .url_message = $url_message | 
    .url = $url | 
    .tear_off_link = $tear_off_link' "$json_file" > tmp.json && mv tmp.json "$json_file"

if [ $? -eq 0 ]; then
    echo "Config file updated successfully."
else
    echo "Error: Failed to update config file."
    exit 1
fi
