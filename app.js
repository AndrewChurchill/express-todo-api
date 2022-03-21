const bodyParser = require('body-parser');
const ejs = require('ejs');
const express = require('express');
const mongoose = require('mongoose');

const app = new express();

app.set('view engine', ejs);

app.use(bodyParser.urlencoded({
    extended: true,
}));

app.use(express.static('public'));

mongoose.connect('mongodb://localhost:27017/todoDB', {
    useNewUrlParser: true,
});

const TodoItem = mongoose.model("TodoItem", {
    message: String,
    isDone: Boolean,
});

const validateTodoInput = (message, isDone) => {
    if (!message) {
        return 'The message property is required.';
    }

    if (!isDone) {
        return 'The isDone property is required.';
    }

    if (message.length <= 0 || message.length > 280) {
        return 'The message can not be empty and cannot exceed 280 characters.';
    }

    if (isDone !== 'true' && isDone !== 'false') {
        return 'Property isDone must be boolean.';
    }
};

const validateIdInput = id => {
    // MongoDB requires that all ID's are 24 hexadecimal chars
    const hexRegex = /^[a-f0-9]{24}$/;
    if (!hexRegex.test(id)) {
        return 'ID must be 24 lowercase hexadecimal chars';
    }
};

const todoRoute = '/api/v1/todos';

app.route(todoRoute)
    .get((_, res) => {
        TodoItem.find((err, foundItems) => {
            if (err) {
                console.error('Failed to get all todo items:', err);
                res.status(500).send('An unknown error occurred.');
            } else {
                const items = foundItems.map(x => ({ _id: x._id, message: x.message, isDone: x.isDone }));
                res.status(200).send(items);
            }
        });
    })
    .post((req, res) => {
        const message = req.body.message;
        const isDone = req.body.isDone;
        const validationError = validateTodoInput(message, isDone);
        if (validationError) {
            res.status(400).send(validationError);
            return;
        }

        const todoItem = new TodoItem({
            message: message,
            isDone: isDone,
        });

        todoItem.save((err, created) => {
            if (err) {
                console.error('Failed to create a todo item:', err);
                res.status(500).send('An unknown error occurred.');
            } else {
                res.status(201).location(todoRoute + '/' + created.id).send();
            }
        });
    });

app.route(todoRoute + '/:id')
    .get((req, res) => {
        TodoItem.findById(req.params.id, (err, item) => {
            if (err || !item) {
                res.status(404).send();
            } else {
                const result = {
                    _id: item._id,
                    message: item.message,
                    isDone: item.isDone,
                };
                res.status(200).send(result);
            }
        });
    })
    .put(async (req, res) => {
        const id = req.params.id;
        const idValidationError = validateIdInput(id);
        if (idValidationError) {
            res.status(404).send();
            return;
        }

        const existing = await TodoItem.findById(id);
        if (!existing) {
            res.status(404).send();
            return;
        }

        const message = req.body.message;
        const isDone = req.body.isDone;
        const inputValidationError = validateTodoInput(message, isDone);
        if (inputValidationError) {
            res.status(400).send(inputValidationError);
            return;
        }

        const update = {
            message: message,
            isDone: isDone,
        };

        TodoItem.findByIdAndUpdate(id, update, (err, updated) => {
            if (err) {
                console.error('An error occurred while updating a todo item:', err);
                res.status(500).send('An unknown error occurred.');
            } else if (!updated) {
                res.status(404).send();
            } else {
                res.status(204).send();
            }
        });
    })
    .delete(async (req, res) => {
        const id = req.params.id;
        const validationError = validateIdInput(id);
        if (validationError) {
            res.status(404).send();
            return;
        }

        const existing = await TodoItem.findById(id);
        if (!existing) {
            res.status(404).send();
            return;
        }

        TodoItem.findByIdAndDelete(id, err => {
            if (err) {
                console.error('An error occurred while deleting a todo item:', err);
                res.status(500).send('An unknown error occurred.');
            } else {
                res.status(204).send();
            }
        });
    });

app.listen(3000, () => {
    console.log('Server started on port 3000');
});