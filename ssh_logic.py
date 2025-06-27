# ssh_logic.py
import paramiko

def ssh_connect(ip, user, passwd, command, is_jump=False, jump_transport=None):
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        if is_jump and jump_transport:
            channel = jump_transport.open_channel(
                kind="direct-tcpip",
                dest_addr=(ip, 22),
                src_addr=("127.0.0.1", 0)
            )
            client.connect(hostname=ip, username=user, password=passwd, sock=channel)
        else:
            client.connect(hostname=ip, username=user, password=passwd)

        stdin, stdout, stderr = client.exec_command(command)
        output = stdout.read().decode().strip()
        error = stderr.read().decode().strip()
        client.close()

        return output if output else error
    except Exception as e:
        return f"Error: {str(e)}"

def execute_ssh_command(ts_ip, ts_user, ts_pass, dev_ip, dev_user, dev_pass, command):
    if isinstance(dev_ip, list):
        dev_ip = dev_ip[0]
    try:
        jump_client = paramiko.SSHClient()
        jump_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        jump_client.connect(hostname=ts_ip, username=ts_user, password=ts_pass)
        transport = jump_client.get_transport()

        output = ssh_connect(
            ip=dev_ip,
            user=dev_user,
            passwd=dev_pass,
            command=command,
            is_jump=True,
            jump_transport=transport
        )
        jump_client.close()
        return output
    except Exception as e:
        return f"JumpHost Error: {str(e)}"

def execute_direct_ssh_command(dev_ip, dev_user, dev_pass, command):
    if isinstance(dev_ip, list):
        dev_ip = dev_ip[0]
    return ssh_connect(dev_ip, dev_user, dev_pass, command)

def execute_ssh_command_multi(ts_ip, ts_user, ts_pass, dev_ips, dev_user, dev_pass, command):
    results = {}
    try:
        jump_client = paramiko.SSHClient()
        jump_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        jump_client.connect(hostname=ts_ip, username=ts_user, password=ts_pass)
        transport = jump_client.get_transport()

        for ip in dev_ips:
            results[ip] = ssh_connect(ip, dev_user, dev_pass, command, is_jump=True, jump_transport=transport)

        jump_client.close()
    except Exception as e:
        for ip in dev_ips:
            results[ip] = f"JumpHost Error: {str(e)}"
    return results

def execute_direct_ssh_command_multi(dev_ips, dev_user, dev_pass, command):
    results = {}
    for ip in dev_ips:
        results[ip] = ssh_connect(ip, dev_user, dev_pass, command)
    return results