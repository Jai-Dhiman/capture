# analyze_user_themes.py
#
# This script performs dimensionality reduction and clustering on user vectors
# to identify potential user themes.
#
# Environment Setup:
# Please ensure you have the following libraries installed:
# pip install umap-learn hdbscan numpy pandas matplotlib seaborn scikit-learn

import numpy as np
import pandas as pd
import umap
import hdbscan
import matplotlib.pyplot as plt
import seaborn as sns
import json
import sys
from sklearn.metrics.pairwise import cosine_similarity # For potential future use

def load_data(vectors_file="user_vectors.npy", ids_file="user_ids.json"):
    """
    Loads user vectors and user ID mapping from specified files.

    Args:
        vectors_file (str): Path to the .npy file containing user vectors.
        ids_file (str): Path to the .json file containing user ID to index mapping.

    Returns:
        tuple: (numpy.ndarray, dict) containing user vectors and user ID map,
               or (None, None) if loading fails.
    """
    print(f"Loading data from {vectors_file} and {ids_file}...")
    try:
        user_vectors = np.load(vectors_file)
        with open(ids_file, 'r') as f:
            user_id_map = json.load(f)
        print(f"Successfully loaded {user_vectors.shape[0]} vectors and {len(user_id_map)} user IDs.")
        return user_vectors, user_id_map
    except FileNotFoundError:
        print(f"Error: One or both files not found: '{vectors_file}', '{ids_file}'.")
        print("Please ensure 'export_user_vectors.py' has been run successfully.")
        return None, None
    except Exception as e:
        print(f"An error occurred while loading data: {e}")
        return None, None

def run_umap(vectors, n_neighbors=30, min_dist=0.1, n_components=2, metric='cosine', random_state=42):
    """
    Reduces dimensionality of vectors using UMAP.

    Args:
        vectors (numpy.ndarray): The high-dimensional user vectors.
        n_neighbors (int): UMAP n_neighbors parameter. Controls local vs. global structure.
        min_dist (float): UMAP min_dist parameter. Controls how tightly UMAP packs points.
        n_components (int): Number of dimensions to reduce to.
        metric (str): Distance metric for UMAP.
        random_state (int): Random state for reproducibility.

    Returns:
        numpy.ndarray: The 2D embeddings, or None if reduction fails.
    """
    print(f"Running UMAP with n_neighbors={n_neighbors}, min_dist={min_dist}, metric='{metric}'...")
    # Note: These UMAP parameters are examples and might need tuning based on the dataset.
    try:
        reducer = umap.UMAP(
            n_neighbors=n_neighbors,
            min_dist=min_dist,
            n_components=n_components,
            metric=metric,
            random_state=random_state,
            low_mem=True # Can be useful for large datasets
        )
        embeddings_2d = reducer.fit_transform(vectors)
        print(f"UMAP reduction complete. Shape of 2D embeddings: {embeddings_2d.shape}")
        return embeddings_2d
    except Exception as e:
        print(f"An error occurred during UMAP reduction: {e}")
        return None

def run_hdbscan(embeddings_2d, min_cluster_size=50, min_samples=5, metric='euclidean'):
    """
    Performs HDBSCAN clustering on 2D embeddings.

    Args:
        embeddings_2d (numpy.ndarray): The 2D embeddings from UMAP.
        min_cluster_size (int): HDBSCAN min_cluster_size.
        min_samples (int): HDBSCAN min_samples. Helps define density.
        metric (str): Metric for HDBSCAN.

    Returns:
        numpy.ndarray: Cluster labels, or None if clustering fails.
    """
    print(f"Running HDBSCAN with min_cluster_size={min_cluster_size}, min_samples={min_samples}...")
    # Note: These HDBSCAN parameters are examples and might need tuning.
    try:
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
            metric=metric,
            # gen_min_span_tree=True # Can be useful for understanding cluster structure
        )
        labels = clusterer.fit_predict(embeddings_2d)
        print(f"HDBSCAN clustering complete. Found {len(np.unique(labels)) -1} clusters (excluding noise).")
        return labels
    except Exception as e:
        print(f"An error occurred during HDBSCAN clustering: {e}")
        return None

def visualize_clusters(embeddings_2d, labels, output_filename='umap_clusters.png'):
    """
    Visualizes the clusters using a scatter plot and saves it.

    Args:
        embeddings_2d (numpy.ndarray): The 2D embeddings.
        labels (numpy.ndarray): Cluster labels for each point.
        output_filename (str): Name of the file to save the plot.
    """
    print(f"Visualizing clusters and saving to {output_filename}...")
    try:
        plt.figure(figsize=(12, 10))
        unique_labels = np.unique(labels)
        
        # Use a color palette that handles noise points well
        palette = sns.color_palette("deep", n_colors=len(unique_labels[unique_labels != -1]))
        color_map = {label: palette[i] for i, label in enumerate(unique_labels[unique_labels != -1])}
        color_map[-1] = (0.5, 0.5, 0.5, 0.3) # Gray for noise, with some transparency

        for label in unique_labels:
            points = embeddings_2d[labels == label]
            plt.scatter(
                points[:, 0],
                points[:, 1],
                s=10 if label != -1 else 5, # Smaller size for noise
                color=color_map[label],
                label=f'Cluster {label}' if label != -1 else 'Noise'
            )
        
        plt.title('User Embeddings Clustered (UMAP + HDBSCAN)')
        plt.xlabel('UMAP Dimension 1')
        plt.ylabel('UMAP Dimension 2')
        plt.legend(title='Cluster ID', bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout(rect=[0, 0, 0.85, 1]) # Adjust layout to make space for legend
        plt.savefig(output_filename)
        plt.close() # Close the plot to free memory
        print(f"Cluster visualization saved to '{output_filename}'.")
    except Exception as e:
        print(f"An error occurred during visualization: {e}")

def calculate_centroids(embeddings_2d, labels):
    """
    Calculates the centroid for each cluster.

    Args:
        embeddings_2d (numpy.ndarray): The 2D embeddings.
        labels (numpy.ndarray): Cluster labels.

    Returns:
        dict: A dictionary mapping cluster_id to its centroid [cx, cy].
              Noise points (-1) are ignored.
    """
    print("Calculating centroids for each cluster...")
    centroids = {}
    unique_labels = np.unique(labels)
    for label in unique_labels:
        if label == -1:  # Skip noise points
            continue
        cluster_points = embeddings_2d[labels == label]
        if cluster_points.shape[0] > 0:
            centroid = np.mean(cluster_points, axis=0)
            centroids[int(label)] = centroid.tolist() # Convert to list for JSON serialization
            print(f"Centroid for Cluster {label}: {centroids[int(label)]}")
    print("Centroid calculation complete.")
    return centroids

def main():
    """
    Main execution block for the analysis pipeline.
    """
    print("Starting user theme analysis pipeline...")

    vectors_file = 'user_vectors.npy'
    ids_file = 'user_ids.json'

    user_vectors, user_id_map = load_data(vectors_file, ids_file)
    if user_vectors is None or user_id_map is None:
        print("Exiting due to data loading failure.")
        sys.exit(1)
    
    if user_vectors.shape[0] == 0:
        print("No user vectors to process. Exiting.")
        sys.exit(1)
    
    # UMAP parameters - these are crucial and dataset-dependent
    # Consider starting with higher n_neighbors for more global structure,
    # or lower for more local detail. min_dist affects embedding density.
    embeddings_2d = run_umap(user_vectors, n_neighbors=30, min_dist=0.1, n_components=2, metric='cosine', random_state=42)
    if embeddings_2d is None:
        print("Exiting due to UMAP failure.")
        sys.exit(1)

    # Create and save user ID to UMAP embedding mapping
    # user_id_map is {"userId": index}
    # embeddings_2d is an array where row index corresponds to the index in user_id_map values
    
    user_umap_embeddings = {}
    print("\nGenerating user ID to UMAP coordinate mapping...")
    for user_id, index in user_id_map.items():
        if index < len(embeddings_2d):
            user_umap_embeddings[user_id] = embeddings_2d[index].tolist()
        else:
            print(f"Warning: Index {index} for user_id {user_id} is out of bounds for UMAP embeddings. Skipping.")

    user_embeddings_output_file = 'user_umap_embeddings.json'
    try:
        with open(user_embeddings_output_file, 'w') as f:
            json.dump(user_umap_embeddings, f, indent=4)
        print(f"User UMAP embeddings saved to '{user_embeddings_output_file}'.")
    except Exception as e:
        print(f"Error saving user UMAP embeddings: {e}")
        # Decide if this is a critical error to sys.exit(1) or just a warning.
        # For now, let's print error and continue with clustering if possible.

    # HDBSCAN parameters - min_cluster_size is very important.
    # min_samples can help fine-tune what constitutes a cluster.
    labels = run_hdbscan(embeddings_2d, min_cluster_size=50, min_samples=5, metric='euclidean')
    if labels is None:
        print("Exiting due to HDBSCAN failure.")
        sys.exit(1)

    visualize_clusters(embeddings_2d, labels, output_filename='umap_clusters.png')

    # Print cluster statistics
    unique_labels, counts = np.unique(labels, return_counts=True)
    print("\nCluster statistics:")
    for label, count in zip(unique_labels, counts):
        if label == -1:
            print(f"Noise points: {count}")
        else:
            print(f"Cluster {label}: {count} users")
    
    if len(unique_labels[unique_labels != -1]) == 0:
        print("\nNo actual clusters found (only noise or empty dataset). Skipping centroid calculation and theme definition.")
    else:
        centroids = calculate_centroids(embeddings_2d, labels)

        theme_definitions = {}
        print("\nGenerating placeholder theme definitions...")
        for cluster_id, centroid in centroids.items():
            theme_definitions[str(cluster_id)] = { # Ensure cluster_id is string for JSON key
                "themeLabel": f"Theme {cluster_id} (NEEDS MANUAL DEFINITION)",
                "centroid": centroid,
                "notes": "Inspect umap_clusters.png and query user data for this cluster to define a meaningful label."
            }
        
        theme_output_file = 'theme_definitions.json'
        try:
            with open(theme_output_file, 'w') as f:
                json.dump(theme_definitions, f, indent=4)
            print(f"\nPlaceholder theme definitions saved to '{theme_output_file}'.")
            print("IMPORTANT: You MUST manually update the 'themeLabel' for each theme in this file")
            print("after inspecting 'umap_clusters.png' and analyzing the users within each cluster.")
        except Exception as e:
            print(f"Error saving theme definitions: {e}")

    print("\nUser theme analysis pipeline finished.")

if __name__ == "__main__":
    main()
