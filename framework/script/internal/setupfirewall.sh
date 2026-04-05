#!/bin/sh

cd "$(dirname "$0")"
. ../../../config.env.sample
. ../../../config.env

if [ $bedrock_clone_java_port = "true" ]; then
  bedrock_port=$server_port
else
  bedrock_port=$bedrock_port_if_no_clone
fi

/sbin/iptables -t nat -A INPUT -p tcp --dport $server_port -j SNAT --to-source 10.131.0.0-10.131.255.255
/sbin/iptables -t nat -A INPUT -p udp --dport $bedrock_port -j SNAT --to-source 10.131.0.0-10.131.255.255
/sbin/ip6tables -t nat -A INPUT -p tcp --dport $server_port -j SNAT --to-source fdef:dead:af::1-fdef:dead:af::ffff
/sbin/ip6tables -t nat -A INPUT -p udp --dport $bedrock_port -j SNAT --to-source fdef:dead:af::1-fdef:dead:af::ffff
