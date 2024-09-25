// src/components/TodoList.jsx
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, deleteDoc, doc, query, where, onSnapshot, updateDoc, getDocs } from "firebase/firestore";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import '../index.css';

const priorities = ["LOW", "MEDIUM", "HIGH"];

const TodoList = () => {
  const [user, setUser] = useState(null);
  const [lists, setLists] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newListName, setNewListName] = useState("");
  const [newTasks, setNewTasks] = useState({});
  const [editingListId, setEditingListId] = useState(null);
  const [editedListName, setEditedListName] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editedTaskDetails, setEditedTaskDetails] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchLists(currentUser.uid);
        fetchTasks(currentUser.uid);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchLists = (userId) => {
    const q = query(collection(db, "lists"), where("userId", "==", userId));
    onSnapshot(q, (querySnapshot) => {
      setLists(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
  };

  const fetchTasks = (userId) => {
    const q = query(collection(db, "tasks"), where("userId", "==", userId));
    onSnapshot(q, (querySnapshot) => {
      setTasks(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
  };

  const addList = async () => {
    if (newListName.trim()) {
      await addDoc(collection(db, "lists"), { name: newListName, userId: user.uid });
      setNewListName("");
    }
  };

  const logOut = async () => {
    try {
      await auth.signOut();
      alert("You have been logged out");
      navigate("/");
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  };

  const addTask = async (listId) => {
    const newTask = newTasks[listId];
    if (newTask && newTask.title.trim()) {
      await addDoc(collection(db, "tasks"), { 
        ...newTask, 
        userId: user.uid, 
        listId 
      });
      setNewTasks({ ...newTasks, [listId]: { title: "", description: "", dueDate: "", priority: "LOW" } });
    }
  };

  const deleteTask = async (taskId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this task?");
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "tasks", taskId));
        console.log("Task deleted successfully");
      } catch (error) {
        console.error("Error deleting task:", error.message);
      }
    }
  };

  const deleteList = async (listId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this list?");
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "lists", listId));
        const q = query(collection(db, "tasks"), where("listId", "==", listId));
        const querySnapshot = await getDocs(q);
        const batch = db.batch();
        querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } catch (error) {
        console.error("Error deleting list:", error.message);
      }
    }
  };

  const enableListEdit = (listId, currentName) => {
    setEditingListId(listId);
    setEditedListName(currentName);
  };

  const updateListName = async (listId) => {
    if (editedListName.trim()) {
      await updateDoc(doc(db, "lists", listId), { name: editedListName });
      setEditingListId(null);
      setEditedListName("");
    }
  };

  const enableTaskEdit = (task) => {
    setEditingTaskId(task.id);
    setEditedTaskDetails({
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority
    });
  };

  const updateTask = async () => {
    if (editedTaskDetails.title.trim()) {
      try {
        await updateDoc(doc(db, "tasks", editedTaskDetails.id), {
          title: editedTaskDetails.title,
          description: editedTaskDetails.description,
          dueDate: editedTaskDetails.dueDate,
          priority: editedTaskDetails.priority
        });
        setEditingTaskId(null);
        setEditedTaskDetails({});
      } catch (error) {
        console.error("Error updating task:", error.message);
      }
    }
  };

  const handleTaskEditChange = (field, value) => {
    setEditedTaskDetails((prevDetails) => ({ ...prevDetails, [field]: value }));
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const draggedTask = tasks.find((task) => task.id === draggableId);
    if (!draggedTask) return;

    const [sourceListId, sourcePriority] = source.droppableId.split("-");
    const [destinationListId, destinationPriority] = destination.droppableId.split("-");

    if (sourceListId === destinationListId && sourcePriority === destinationPriority) {
      return;
    }

    const newPriority = destinationPriority || "LOW";

    try {
      await updateDoc(doc(db, "tasks", draggableId), {
        listId: destinationListId,
        priority: newPriority
      });
      fetchTasks(user.uid); // Refresh tasks to reflect changes
    } catch (error) {
      console.error("Error updating task:", error.message);
    }
  };

  const handleNewTaskChange = (listId, field, value) => {
    const updatedNewTasks = { ...newTasks };
    if (!updatedNewTasks[listId]) {
      updatedNewTasks[listId] = { title: "", description: "", dueDate: "", priority: "LOW" };
    }
    updatedNewTasks[listId][field] = value;
    setNewTasks(updatedNewTasks);
  };

  return (
    <div className="flex w-full justify-center">
      <div className="bg-skyblue-800 rounded-lg p-4 w-3/4">
        <div className="mb-6">
          <button
            onClick={logOut}
            className="bg-yellow-500 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Log Out
          </button>
        </div>
        <h1 className="text-4xl mb-4 text-cyan-50 text-center">TODO LIST</h1>
        <div className="mb-6 flex items-center space-x-4">
          <input
            className="text-zinc-900 py-2 px-4 rounded-md w-full"
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Create a List"
          />
          <button
            onClick={addList}
            className="bg-pink-600 hover:bg-pink-800 text-white py-2 px-4 rounded-md transition-colors"
          >
            Add List
          </button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-3 gap-4">
            {lists.map((list) => (
              <div key={list.id} className="bg-blue-600 p-6 rounded-lg">
                {editingListId === list.id ? (
                  <div className="mb-4">
                    <input
                      className="text-pink-900 py-2 px-4 rounded-md w-full"
                      type="text"
                      value={editedListName}
                      onChange={(e) => setEditedListName(e.target.value)}
                      placeholder="Edit List Name"
                    />
                    <div className="flex space-x-4 mt-2">
                      <button
                        onClick={() => updateListName(list.id)}
                        className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingListId(null)}
                        className="bg-gray-500 hover:bg-gray-700 text-white py-1 px-2 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl text-gray-200">{list.name}</h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => enableListEdit(list.id, list.name)}
                        className="bg-yellow-500 text-white py-1 px-2 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteList(list.id)}
                        className="bg-red-500 text-white py-1 px-2 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  {priorities.map((priority) => (
                    <Droppable key={priority} droppableId={`${list.id}-${priority}`}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="mb-4"
                        >
                          <h3 className="text-lg text-gray-100">{priority} Priority</h3>
                          {tasks
                            .filter((task) => task.listId === list.id && task.priority === priority)
                            .map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="bg-gray-100 p-4 mb-2 rounded-md shadow-md"
                                  >
                                    {editingTaskId === task.id ? (
                                      <div>
                                        <input
                                          className="text-zinc-900 py-2 px-4 rounded-md w-full"
                                          type="text"
                                          value={editedTaskDetails.title}
                                          onChange={(e) => handleTaskEditChange('title', e.target.value)}
                                          placeholder="Edit Task Title"
                                        />
                                        <textarea
                                          className="text-zinc-900 py-2 px-4 rounded-md w-full mt-2"
                                          value={editedTaskDetails.description}
                                          onChange={(e) => handleTaskEditChange('description', e.target.value)}
                                          placeholder="Edit Task Description"
                                        />
                                        <input
                                          className="text-zinc-900 py-2 px-4 rounded-md w-full mt-2"
                                          type="date"
                                          value={editedTaskDetails.dueDate}
                                          onChange={(e) => handleTaskEditChange('dueDate', e.target.value)}
                                        />
                                        <select
                                          className="text-zinc-900 py-2 px-4 rounded-md w-full mt-2"
                                          value={editedTaskDetails.priority}
                                          onChange={(e) => handleTaskEditChange('priority', e.target.value)}
                                        >
                                          <option value="LOW">Low</option>
                                          <option value="MEDIUM">Medium</option>
                                          <option value="HIGH">High</option>
                                        </select>
                                        <button
                                          onClick={updateTask}
                                          className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded mt-2"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingTaskId(null)}
                                          className="bg-gray-500 hover:bg-gray-700 text-white py-1 px-2 rounded mt-2 ml-2"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <div>
                                        <h4 className="text-md font-bold">{task.title}</h4>
                                        <p>{task.description}</p>
                                        <p className="text-sm text-gray-600">Due: {task.dueDate}</p>
                                        <button
                                          onClick={() => enableTaskEdit(task)}
                                          className="bg-yellow-500 text-white py-1 px-2 rounded mt-2"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => deleteTask(task.id)}
                                          className="bg-red-500 text-white py-1 px-2 rounded mt-2 ml-2"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  ))}
                </div>

                <div className="mt-4">
                  <input
                    className="text-zinc-900 py-2 px-4 rounded-md w-full"
                    type="text"
                    value={newTasks[list.id]?.title || ""}
                    onChange={(e) => handleNewTaskChange(list.id, "title", e.target.value)}
                    placeholder="New Task Title"
                  />
                  <textarea
                    className="text-zinc-900 py-2 px-4 rounded-md w-full mt-2"
                    value={newTasks[list.id]?.description || ""}
                    onChange={(e) => handleNewTaskChange(list.id, "description", e.target.value)}
                    placeholder="Task Description"
                  />
                  <input
                    className="text-zinc-900 py-2 px-4 rounded-md w-full mt-2"
                    type="date"
                    value={newTasks[list.id]?.dueDate || ""}
                    onChange={(e) => handleNewTaskChange(list.id, "dueDate", e.target.value)}
                  />
                  <select
                    className="text-zinc-900 py-2 px-4 rounded-md w-full mt-2"
                    value={newTasks[list.id]?.priority || "LOW"}
                    onChange={(e) => handleNewTaskChange(list.id, "priority", e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                  <button
                    onClick={() => addTask(list.id)}
                    className="bg-pink-600 hover:bg-pink-800 text-white py-2 px-4 rounded-md transition-colors mt-2"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

export default TodoList;
