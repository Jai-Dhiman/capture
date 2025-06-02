import json
import numpy as np
import subprocess
import sys

def get_user_ids():
    """
    Executes 'wrangler kv:key list' to get all user IDs.
    Returns a list of user IDs.
    """
    try:
        process = subprocess.run(
            ["wrangler", "kv:key", "list", "--binding=USER_VECTORS", "--prefix="],
            capture_output=True,
            text=True,
            check=True
        )
        # Assuming each key (user_id) is on a new line in the output
        user_ids = [line.strip() for line in process.stdout.strip().split('\n') if line.strip()]
        if not user_ids:
            print("No user IDs found from wrangler kv:key list command.")
        return user_ids
    except FileNotFoundError:
        print("Error: 'wrangler' command not found. Please ensure it is installed and in your PATH.")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error executing 'wrangler kv:key list': {e}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred while getting user IDs: {e}")
        sys.exit(1)

def get_user_vector(user_id):
    """
    Executes 'wrangler kv:key get' for a given user_id.
    Parses and returns the vector as a list of numbers.
    Returns None if an error occurs.
    """
    try:
        process = subprocess.run(
            ["wrangler", "kv:key", "get", "--binding=USER_VECTORS", user_id],
            capture_output=True,
            text=True,
            check=True
        )
        # Assuming the output is a JSON string representing the vector
        vector_str = process.stdout.strip()
        if not vector_str:
            print(f"Warning: No data returned for user ID '{user_id}'. Skipping.")
            return None
        vector = json.loads(vector_str)
        if not isinstance(vector, list) or not all(isinstance(x, (int, float)) for x in vector):
            print(f"Warning: Vector for user ID '{user_id}' is not a list of numbers. Value: '{vector_str}'. Skipping.")
            return None
        return vector
    except FileNotFoundError:
        # This error should ideally be caught by the first wrangler call, but good to have
        print("Error: 'wrangler' command not found during get. Please ensure it is installed and in your PATH.")
        sys.exit(1) # Exit if wrangler disappears mid-script
    except subprocess.CalledProcessError as e:
        print(f"Error executing 'wrangler kv:key get' for user ID '{user_id}': {e}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        return None
    except json.JSONDecodeError:
        print(f"Error parsing JSON for user ID '{user_id}'. Value: '{process.stdout.strip()}'. Skipping.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while getting vector for user ID '{user_id}': {e}")
        return None

def main():
    """
    Main function to orchestrate fetching user vectors and saving them.
    """
    print("Starting user vector export process...")

    user_ids = get_user_ids()
    if not user_ids:
        print("No user IDs to process. Exiting.")
        return

    print(f"Found {len(user_ids)} user IDs.")

    vectors_list = []
    user_id_to_index_map = {}

    for index, user_id in enumerate(user_ids):
        print(f"Processing user ID: {user_id} ({index + 1}/{len(user_ids)})...")
        vector = get_user_vector(user_id)
        if vector is not None:
            vectors_list.append(vector)
            user_id_to_index_map[user_id] = len(vectors_list) - 1 # Current index in vectors_list
        else:
            print(f"Skipped user ID: {user_id} due to errors.")

    if not vectors_list:
        print("No vectors were successfully processed. Exiting.")
        return

    print(f"\nSuccessfully processed {len(vectors_list)} vectors out of {len(user_ids)} user IDs.")

    try:
        # Convert list of vectors to NumPy array
        vectors_numpy_array = np.array(vectors_list)
        print(f"Shape of the NumPy array: {vectors_numpy_array.shape}")

        # Save NumPy array
        np.save("user_vectors.npy", vectors_numpy_array)
        print("User vectors saved to user_vectors.npy")

        # Save user ID map
        with open("user_ids.json", "w") as f:
            json.dump(user_id_to_index_map, f, indent=4)
        print("User ID map saved to user_ids.json")

    except Exception as e:
        print(f"Error during data saving: {e}")
        sys.exit(1)

    print("\nData export completed successfully.")

if __name__ == "__main__":
    main()
