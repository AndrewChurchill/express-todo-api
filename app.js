const bodyParser = require('body-parser');
const ejs = require('ejs');
const express = require('express');
const mongoose = require('mongoose');

let port = process.env.PORT;
if (!port) {
    port = 3000;
}

let dbConnectionString = process.env.DB_CONNECTION_STRING;
if (!dbConnectionString) {
    dbConnectionString = 'mongodb://localhost:27017/todoDB?retryWrites=true&w=majority';
}

let basicAuthToken = process.env.BASIC_AUTH_TOKEN;
if (!basicAuthToken) {
    basicAuthToken = 'MySuperSecretPassword123&';
}

const app = new express();

app.set('view engine', ejs);

app.use(bodyParser.urlencoded({
    extended: true,
}));

app.use(express.static('public'));

app.use((req, res, next) => {
    // This is just a placeholder for actual authentication/authorization.
    if (req.header('Authorization') !== basicAuthToken) {
        res.status(401).send();
        return;
    }

    next();
});

mongoose.connect(dbConnectionString, {
    useNewUrlParser: true,
});

const TodoItem = mongoose.model("TodoItem", {
    message: String,
    isDone: Boolean,
});

const canConvertToBool = bool => {
    return bool === 'true' || bool === 'false';
};

const validateTodoInput = (message, isDone) => {
    if (!message) {
        return 'The message property is required.';
    }

    if (!isDone) {
        return 'The isDone property is required.';
    }

    if (message.length = 0) {
        return 'The message cannot be empty.';
    }

    if (message.length > 280) {
        return 'The message cannot exceed 280 characters.';
    }

    if (!canConvertToBool(isDone)) {
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
    .get((req, res) => {
        const queryParams = {};

        const isDoneParam = req.query.isDone;
        if (isDoneParam) {
            if (!canConvertToBool(isDoneParam)) {
                res.status(400).send('Cannot convert isDone query param to boolean');
                return;
            }

            queryParams.isDone = isDoneParam;
        }

        TodoItem.find(queryParams, (err, foundItems) => {
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

app.listen(port, () => {
    console.log('Server started on port', port);
});