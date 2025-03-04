import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';

interface PostSettingsMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export const PostSettingsMenu = ({ 
  isVisible, 
  onClose, 
  onDelete,
  isDeleting 
}: PostSettingsMenuProps) => {
  
  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            <Text style={styles.deleteText}>
              {isDeleting ? 'Deleting...' : 'Delete Post'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  menuContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: 30
  },
  menuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  deleteText: {
    color: '#ff3b30',
    fontSize: 18,
    textAlign: 'center'
  },
  cancelButton: {
    padding: 16,
    marginTop: 8
  },
  cancelText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#007aff'
  }
});