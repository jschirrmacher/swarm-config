#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "❌ This script must be run as root"
  exit 1
fi

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ] || [ -z "$5" ]; then
  echo "Usage: sudo bash install-msmtp.sh <smtp-host> <port> <from> <user> <password>"
  exit 1
fi

apt install -y msmtp

cat > /etc/msmtprc <<EOF
defaults
auth           on
tls            on
tls_starttls   on
logfile        /var/log/msmtp.log

account        default
host           $1
port           $2
from           $3
user           $4
password       $5
EOF
chmod 600 /etc/msmtprc

echo "✅ msmtp configured. Test with: echo 'Test' | msmtp -a default recipient@example.com"
