import paramiko
import socket
import getpass

def ssh_connect(ip, user, passwd, is_jump=False, jump_transport=None):
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

        return client  # Keep the client alive for interactive use
    except socket.gaierror:
        print(f"[!] Hostname resolution failed for: {ip}")
    except Exception as e:
        print(f"[!] Connection Error: {str(e)}")
    return None


def interactive_shell(client):
    print("Connected. Type `exit` to disconnect.")
    while True:
        try:
            cmd = input(">>> ")
            if cmd.strip().lower() in ["exit", "quit"]:
                break
            stdin, stdout, stderr = client.exec_command(cmd)
            output = stdout.read().decode().strip()
            error = stderr.read().decode().strip()
            if output:
                print(output)
            if error:
                print("[stderr]", error)
        except Exception as e:
            print(f"[!] Command Error: {str(e)}")
            break


def connect_direct():
    print("\n[ Direct Device Connection ]")
    ip = input("Enter device IP or hostname: ")
    user = input("Username: ")
    passwd = getpass.getpass("Password: ")

    client = ssh_connect(ip, user, passwd)
    if client:
        interactive_shell(client)
        client.close()
    else:
        print("[!] Failed to connect to device.")


def connect_via_terminal():
    print("\n[ Terminal Server Jump Connection ]")
    ts_ip = input("Enter Terminal Server IP or hostname: ")
    ts_user = input("Terminal Server Username: ")
    ts_pass = getpass.getpass("Terminal Server Password: ")
    ts_ip = "11.0.0.100"
    ts_user = "vinish"
    ts_pass = "ICICI1@src"
    dev_ip = input("Enter Device IP or hostname: ")
    dev_user = input("Device Username: ")
    dev_pass = getpass.getpass("Device Password: ")
    dev_ip = "11.0.0.110"
    dev_user = "cisco"
    dev_pass = "cisco"
    ts_client = paramiko.SSHClient()
    ts_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ts_client.connect(hostname=ts_ip, username=ts_user, password=ts_pass)
        transport = ts_client.get_transport()

        dev_client = ssh_connect(
            ip=dev_ip,
            user=dev_user,
            passwd=dev_pass,
            is_jump=True,
            jump_transport=transport
        )

        if dev_client:
            interactive_shell(dev_client)
            dev_client.close()
        else:
            print("[!] Failed to connect to device via terminal server.")

    except Exception as e:
        print(f"[!] JumpHost Error: {str(e)}")
    finally:
        ts_client.close()


def main():
    print("SSH CLI Tool")
    print("============")
    print("1. Connect via Terminal Server")
    print("2. Connect directly to Device")
    print("")

    choice = input("Enter option (1 or 2): ").strip()
    if choice == "1":
        connect_via_terminal()
    elif choice == "2":
        connect_direct()
    else:
        print("[!] Invalid option selected.")


if __name__ == "__main__":
    main()
